/// <reference path="../../../definitions/index.d.ts" />
import { inject, injectable } from 'inversify'
import T from '../types'
import { RetsErrorCodes } from './interfaces'
import { Models, Context, ResoType, Rets } from 'etl'
import { ILogger } from 'infrastructure-logging-lib'
import { RetsClientService, FieldFormats } from './retsClientService'
import * as RetsClient from 'rets-client'
import * as Promise from 'bluebird'
import _ = require('lodash')
import * as config from 'config'
import * as moment from 'moment'
import * as Rx from 'rx'
const debug = require('debug')('RetsImporterService')
import { eachLimit, parallelLimit, retry } from 'async'
import {
  ImportResourceClassResponse, ImportListingsResponse, ResourceClassResponse,
  ResourceClassResponseReduced, ResourceClassImagesResponse, RetsDocumentImagesTuple
} from './interfaces'

function isRetsReplyError(err?: any): err is RetsClient.RetsReplyError {
  return err && err instanceof RetsClient.RetsReplyError
}

@injectable()
export class RetsImporterService {
  static RESOURCE_CONCURRENCY = config.has('RetsImporterService.resourceConcurrency')
    ? parseInt(config.get<string>('RetsImporterService.resourceConcurrency'), 10)
    : 3
  static CLASS_CONCURRENCY = config.has('RetsImporterService.classConcurrency')
    ? parseInt(config.get<string>('RetsImporterService.classConcurrency'), 10)
    : 3
  static DEFAULT_QUERY_OPTIONS: RetsClient.IQueryOptions = config.has('RetsImporterService.defaultQueryOptions')
    ? config.get<RetsClient.IQueryOptions>('RetsImporterService.defaultQueryOptions')
    : { limit: 1000, offset: 0, restrictedIndicator: '' }
  static DEFAULT_RETS_METHOD: string = config.has('RetsImporterService.defaultRetsMethod')
    ? config.get<string>('RetsImporterService.defaultRetsMethod')
    : 'GET'
  static QUERY_TIMESTAMP_PATTERN: string = config.has('RetsImporterService.queryTimestampPattern')
    ? config.get<string>('RetsImporterService.queryTimestampPattern')
    : '#{TIMESTAMP}'
  /** env LRT_VALUE, number */
  static LRT_VALUE: number = config.has('RetsImporterService.defaultLastRunTimeSubtractValue')
    ? parseInt(config.get<string>('RetsImporterService.defaultLastRunTimeSubtractValue'), 10)
    : 1
  /** env LRT_UNIT, example moment string 'days', 'minutes' */
  static LRT_UNIT = config.has('RetsImporterService.defaultLastRunTimeSubtractUnitOfTime')
    ? config.get<string>('RetsImporterService.defaultLastRunTimeSubtractUnitOfTime')
    : 'days'
  /** env LRT_DIRECTION, + or - */
  static LRT_DIRECTION: string = config.has('RetsImporterService.queryDirection')
    ? config.get<string>('RetsImporterService.queryDirection')
    : '+'

  static PHOTO_TYPE: string = config.has('RetsImporterService.photoType')
    ? config.get<string>('RetsImporterService.photoType')
    : 'HiRes'

  /** Default # of resources to group together for RETS image requests */
  static PHOTO_QUERY_ID_COUNT = config.has('RetsImporterService.photoQueryIdCount')
    ? parseInt(config.get<string>('RetsImporterService.photoQueryIdCount'), 10)
    : 5

  /** Default concurrency for simultaneous RETS image requests in the same Resource, Class */
  static IMAGES_CONCURRENCY = config.has('RetsImporterService.imagesConcurrency')
    ? parseInt(config.get<string>('RetsImporterService.imagesConcurrency'), 10)
    : 10

  constructor(
    @inject(T.RetsClientService) private retsClientService: RetsClientService,
    @inject(T.ILogger) private logger: ILogger) {
    if (!retsClientService) {
      throw new TypeError('retsClientService')
    }
  }

  static mapClientSettings(importSettings: Models.RetsImportConfig): RetsClient.ClientSettings {
    if (!importSettings || !importSettings.connection) {
      throw new TypeError('connection')
    }
    return RetsImporterService.mapRetsConnection(importSettings.connection)
  }
  static mapRetsConnection(retsConnection: Models.RetsConnection): RetsClient.ClientSettings {
    let clientSettings: RetsClient.ClientSettings = {
      username: retsConnection.username,
      password: retsConnection.password,
      userAgent: retsConnection.userAgent,
      userAgentPassword: retsConnection.userAgentPassword,
      loginUrl: retsConnection.url,
      version: retsConnection.retsVersion,
      // todo how is the schema going to specify METHOD
      method: retsConnection.method || RetsImporterService.DEFAULT_RETS_METHOD
    }
    if (retsConnection.requestDebugFunction) {
      clientSettings.requestDebugFunction = retsConnection.requestDebugFunction
    }
    return clientSettings
  }
  static mapClassNames(classList: Models.ClassResource[]) {
    return _.map<Models.ClassResource, string>(classList, (c) => {
      return c.className
    })
  }
  static reduceLoadListingResponses(responses: ArrayLike<ResourceClassResponse>): ImportListingsResponse {
    function reduceLoadListingResponsesIterator(
      result: ImportListingsResponse,
      value: ResourceClassResponse[],
      key: string) {
      result.resources.push({
        resoType: key as ResoType,
        classes: value
      })
      return result
    }

    let responsesByResoType = _.chain(responses)
      .flattenDeep<ResourceClassResponse>()
      .groupBy(function selectResoType(response: ResourceClassResponse) {
        return response.resoType
      })
      .value()

    return _.reduce<ResourceClassResponse[], ImportListingsResponse>(
      responsesByResoType,
      // iterate and gather the classes[] for each resource resoType
      reduceLoadListingResponsesIterator,
      { resources: [] })
  }

  static determineLastModTime(
    classModel: Models.ClassResource,
    queryStat?: Models.RetsQueryStats): moment.Moment {
    if (!queryStat) {
      return moment.invalid()
    }
    return moment.utc(queryStat.lastRunTime)
  }

  static determineSearchString(
    resourceModel: Models.RetsResource,
    classModel: Models.ClassResource,
    importConfig: Models.RetsImportConfig,
    queryModel?: Models.IQuery
  ): string {
    let searchString = queryModel && queryModel.query
      ? queryModel.query
      : _.get(classModel, 'query', _.get(resourceModel, 'query', ''))
    let queryStat = RetsImporterService.determineRetsQueryStats(resourceModel.resourceName, classModel.className, importConfig)
    let lastRunTimeMoment = RetsImporterService.determineLastModTime(classModel, queryStat)
    let lastRunTimeFormat = importConfig.dateTimeFormat || FieldFormats.DateTime
    let replacement = ''
    if (lastRunTimeMoment.isValid()) {
      // query RETS based on the lastRunTime date
      replacement = lastRunTimeMoment.format(lastRunTimeFormat)
    } else {
      // query RETS from a default time LRT_VALUE -(1) LRT_UNIT (days) prior
      replacement = moment()
        .utc()
        .add(-1 * RetsImporterService.LRT_VALUE as number, RetsImporterService.LRT_UNIT as any)
        .format(lastRunTimeFormat)
    }
    if (replacement) {
      // append the + to the TIMESTAMP
      replacement += RetsImporterService.LRT_DIRECTION
    }
    searchString = _.replace(searchString, RetsImporterService.QUERY_TIMESTAMP_PATTERN, replacement)
    return searchString
  }

  static determineQueryOptions(resource: Models.RetsResource): RetsClient.IQueryOptions {
    const props: (keyof (Models.RetsResource))[] = ['limit', 'offset', 'limitCalls', 'restrictedIndicator']
    const resourceOptions = _.pick(resource, props)
    let options = _.extend({}, RetsImporterService.DEFAULT_QUERY_OPTIONS, resourceOptions)
    if (resource.offsetNotSupported) {
      options = _.omit(options, 'offset') as RetsClient.IQueryOptions
      options.offsetNotSupported = true
    }
    return options as RetsClient.IQueryOptions
  }
  static determineRetsQueryStats(
    resourceName: string,
    className: string,
    importConfig: Models.RetsImportConfig): Models.RetsQueryStats {
    return _.first(_.filter(importConfig.retsQueryStats, (stat: Models.RetsQueryStats) => {
      return stat &&
        _.eq(stat.resourceName, resourceName) &&
        _.eq(stat.className, className)
    }))
  }
  static requestDebugFunction = (logger: ILogger, requestType: string, requestData: any) => {
    logger.audit('rets-client request', 'debug', { requestType, requestData })
  }

  /**
   * Top level method to import all properties from a RetsImportConfig
   * Performs authentication against the RETS server, and returns a promise
   * to signal automatic logout when all operations are complete
   */
  importListings(importConfig: Models.RetsImportConfig, context: Context) {
    const logger = this.logger
    logger.audit('RetsImporterService.importListings', 'info', {
      importId: importConfig.importId,
      connection: _.omit(importConfig.connection, ['password', 'userAgentPassword'])
    })
    const requestDebugFunction = RetsImporterService.requestDebugFunction.bind(this, this.logger)
    return new Promise<ImportListingsResponse>((resolve, reject) => {
      let clientSettings = RetsImporterService.mapClientSettings(importConfig)
      if (!_.isFunction(clientSettings.requestDebugFunction)) {
        clientSettings.requestDebugFunction = requestDebugFunction
      }
      const service = this.retsClientService
      const self = this
      service.getClient(
        clientSettings,
        (client) => {
          let clientPromise = self.importResourceClasses(client, importConfig, context)
          clientPromise
            .then((result) => setTimeout(resolve, 0, result))
            .catch((err) => setTimeout(reject, 0, err))
          return clientPromise
        }).catch((err) => setTimeout(reject, 0, err))
    })
  }

  /**
   * Handles mapping of each Resource Class in a RetsImportConfig
   */
  importResourceClasses(
    client: RetsClient.IClient,
    importConfig: Models.RetsImportConfig,
    context: Context) {
    let self = this
    return Rx.Observable.fromArray(importConfig.resources || [])
      .flatMap(
      function mapClasses(resourceModel) {
        return Rx.Observable.fromArray(resourceModel.classes || [])
      },
      function resultSelector(resourceModel, classModel) {
        classModel.resourceName = resourceModel.resourceName
        return { resourceModel, classModel }
      })
      .flatMapWithMaxConcurrent(
      // maxConcurrent
      RetsImporterService.RESOURCE_CONCURRENCY * RetsImporterService.CLASS_CONCURRENCY,
      function importResourceClassAction(value) {
        debug('importResourceClassAction')
        return Promise.resolve(self.importResourceClassComposer(
          client,
          value.resourceModel,
          value.classModel,
          importConfig))
      })
      .reduce(
      function accumulator(acc, value) {
        acc.push(value)
        return acc
      },
      // seed an empty ResourceClassResponse[]
      [] as ResourceClassResponse[])
      .toPromise(Promise)
      .then(function (responses) {
        return RetsImporterService.reduceLoadListingResponses(responses)
      })
  }

  /**
   * Iterates each resource class and composes the top level
   * import operations of each.
   * Responsible to triggering post processing for each resource class
   * to reduce results and gather images
   */
  importResourceClassComposer(
    client: RetsClient.IClient,
    resource: Models.RetsResource,
    classModel: Models.ClassResource,
    importSettings: Models.RetsImportConfig
  ): Promise<ResourceClassImagesResponse> {
    let response: ResourceClassResponse = null
    return Promise.bind(this)
      // get all the data per resource & class
      .then(() => this.importResourceClass(client, resource, classModel, importSettings))
      // remove duplicates per resource & class
      .then((result: ImportResourceClassResponse[]) => {
        return this.reduceResourceClassResponses(resource, classModel, result)
      })
      // import images for all properties per resource & class
      .then((result: ResourceClassResponseReduced) => {
        // map results into chunks and pull images
        return this.importResourceClassImages(client, resource, classModel, importSettings, result)
      })
      .catch((err) => {
        let response: ResourceClassImagesResponse = {
          err: err,
          resoType: resource.resoType,
          resourceName: resource.resourceName,
          className: classModel.className,
          classModel: classModel,
          results: [],
          retsDocumentImagesTuples: []
        }
        this.logger.error(err, { method: 'importResourceClassComposer', response })
        return response
      })
  }

  /**
   * reduces a list of queries within class and returns response of distinct results
   * Goal is the select a distinct list of RETS results based on the uniqueIdField
   * because it's likely that the same RETS document was returned because of data modification
   * query as well as photo modification query
   */
  reduceResourceClassResponses(
    resource: Models.RetsResource,
    classModel: Models.ClassResource,
    responses: ImportResourceClassResponse[]): ResourceClassResponseReduced {

    let flatMapResults = _.flatMap(responses, (response) => response.results)
    let flatMapRequests = _.flatMap(responses, (response) => response.requests)
    let flatMapResponses = _.flatMap(responses, (response) => response.responses)
    let mappedOptions = _.map(responses, (response) => response.queryOptions)
    let uniqueMappedResults = _.uniqBy(flatMapResults, function (value) {
      return _.get<string>(value, resource.retsQueryFields.uniqueIdField)
    })

    this.logger.telemetry(
      'RetsImporterService.reduceResourceClassResponses', 'deduped_properties', 'count',
      flatMapResults.length - uniqueMappedResults.length, {
        resourceName: resource.resourceName,
        className: classModel.className,
        countBefore: flatMapResults.length,
        countAfter: uniqueMappedResults.length,
        uniqueIdField: resource.retsQueryFields.uniqueIdField
      })

    return {
      resoType: resource.resoType,
      resourceName: resource.resourceName,
      className: classModel.className,
      classModel: classModel,
      results: uniqueMappedResults,
      queryOptions: mappedOptions,
      requests: flatMapRequests,
      responses: flatMapResponses
    }
  }

  /**
   * Retrieves the entire list of images for all the listings returned
   * for an individual RETS Resource/Class
   * response.results could be anything from 5 to 5k...
   * Probably bad to do an 5K getImages queries
   * So, goal is to chunk/divide the results into groups and map each group into N getImages queries
   * Then, reduce the N getImages queries and expand back into the retsDocumentImagesTuples
   */
  importResourceClassImages(
    client: RetsClient.IClient,
    resource: Models.RetsResource,
    classModel: Models.ClassResource,
    importConfig: Models.RetsImportConfig,
    resourceClassResponse: ResourceClassResponseReduced): Promise<ResourceClassImagesResponse> {
    let retsDocumentImagesTuples: RetsDocumentImagesTuple[] = []
    let self = this
    return Rx.Observable.fromArray(resourceClassResponse.results)
      // chunk the processing to query X rets document images at a time
      .bufferWithCount(RetsImporterService.PHOTO_QUERY_ID_COUNT)
      // query rets server for images with specified maxConcurrent
      .flatMapWithMaxConcurrent(
      // maxConcurrent
      RetsImporterService.IMAGES_CONCURRENCY,
      // perform importImages action for each buffered group of rets document
      function importMultipleRetsDocumentImagesAction(retsDocuments: RetsClient.IResource[]) {
        debug('importMultipleRetsDocumentImagesAction')
        // user defer alongside flatMapWithMaxConcurrent
        return Rx.Observable.defer<Rets.RetsImageResponse[]>(() => {
          return self.importMultipleRetsDocumentImages(client, resource, retsDocuments)
        })
      },
      // select each result as a tuple of retsDocuments[] and retsImageResponses[]
      function resultSelector(retsDocuments, retsImageResponses) {
        return { retsDocuments, retsImageResponses }
      })
      .flatMap<RetsDocumentImagesTuple>(function mapMultipleRetsDocumentImageResponses(tuple) {
        return self.processRetsImageResponses(
          tuple.retsDocuments,
          tuple.retsImageResponses,
          resource.retsQueryFields.uniqueIdField)
      })
      .doOnNext(function onNext(tuple) {
        retsDocumentImagesTuples.push(tuple)
      })
      .toPromise(Promise)
      .then(() => {
        return _.assign(resourceClassResponse, { retsDocumentImagesTuples })
      })
  }

  importMultipleRetsDocumentImages(
    client: RetsClient.IClient,
    resource: Models.RetsResource,
    retsDocuments: RetsClient.IResource[]): Promise<Rets.RetsImageResponse[]> {
    let ids = _.map(retsDocuments, (doc) => _.get<string>(doc, resource.retsQueryFields.uniqueIdField))
    return Promise.try(() => this.retsClientService.importImages(
      client,
      resource.resourceName,
      ids,
      RetsImporterService.PHOTO_TYPE))
  }

  /**
   * Process each chunk/group of importImages responses
   * and binds each image set by the retsDocuments uniqueIdField <> contentId
   * See _.map, _.groupBy, etc.
   * Ignores and warns of image errors
   */
  processRetsImageResponses(
    retsDocuments: RetsClient.IResource[],
    retsImageResponses: Rets.RetsImageResponse[],
    uniqueFieldId: string,
    aggregator?: (data: RetsDocumentImagesTuple) => void): Rx.Observable<RetsDocumentImagesTuple> {
    const logger = this.logger
    let groupedImageResponses = _.groupBy(retsImageResponses, 'headerInfo.contentId')
    const imageResponseFilter = (retsDocumentId: string, imageResponse: Rets.RetsImageResponse) => {
      if (imageResponse.error) {
        if (isRetsReplyError(imageResponse.error)) {
          switch (imageResponse.error.replyCode) {
            case RetsErrorCodes.NO_OBJECT_FOUND.toString():
              logger.audit('RetsErrorCodes.NO_OBJECT_FOUND', 'warn', {
                retsDocumentId,
                uniqueFieldId,
                retsReplyError: imageResponse.error
              })
              break
            default:
              logger.error(imageResponse.error, {
                retsDocumentId,
                uniqueFieldId,
                method: 'RetsImporterService.processRetsImageResponses'
              })
              break
          }
        } else {
          logger.error(imageResponse.error, { retsDocumentId, uniqueFieldId })
        }
        return false
      }
      return true
    }
    const selectRetsDocumentImages = (retsDocument: RetsClient.IResource) => {
      let retsDocumentId = _.get<string>(retsDocument, uniqueFieldId)
      let images = _.get<Rets.RetsImageResponse[]>(groupedImageResponses, retsDocumentId, [])
      return Rx.Observable.fromArray(images)
        .filter((imageResponse: Rets.RetsImageResponse) => imageResponseFilter(retsDocumentId, imageResponse))
        .toArray()
    }
    const retsDocumentImageTupleSelector = (
      retsDocumentBody: RetsClient.IResource,
      retsDocumentImages: Rets.RetsImageResponse[]): RetsDocumentImagesTuple => {
      let retsDocumentId = _.get<string>(retsDocumentBody, uniqueFieldId)
      return {
        retsDocumentBody,
        retsDocumentImages,
        retsDocumentId
      }
    }
    return Rx.Observable.fromArray(retsDocuments)
      .flatMap(selectRetsDocumentImages, retsDocumentImageTupleSelector)
      .doOnNext(function onNextRetsDocumentImageTuple(tuple: RetsDocumentImagesTuple) {
        if (_.isFunction(aggregator)) {
          aggregator(tuple)
        }
      })
  }

  /**
   * Performs one or more queries for RETS data based on photo_last_mod and last_mod
   * queries based on the last tracked run time
   *
   * If either the photo_last_mod or last_mod failed, then an err is thrown
   */
  importResourceClass(
    client: RetsClient.IClient,
    resource: Models.RetsResource,
    classModel: Models.ClassResource,
    importConfig: Models.RetsImportConfig): Promise<ImportResourceClassResponse[]> {
    let resourceName = resource.resourceName
    let className = classModel.className
    let retsQueryStat = RetsImporterService.determineRetsQueryStats(resourceName, className, importConfig)
    const fnExecuteQuery = (queryModel?: Models.IQuery) => {
      let queryOptions = RetsImporterService.determineQueryOptions(resource)
      let query = RetsImporterService.determineSearchString(resource, classModel, importConfig, queryModel)
      this.logger.audit('RetsImporterService.importResourceClass', 'info', {
        resourceName, className, query, retsQueryStat, queryOptions
      })
      return Promise.bind(this)
        .then(() => this.retsClientService.loadListings(client, resourceName, className, query, queryOptions))
        .then(function (response: ImportResourceClassResponse) {
          response.classModel = classModel
          response.resoType = resource.resoType
          response.queryModel = queryModel
          response.retsQueryStat = retsQueryStat
          return response
        })
    }
    if (_.isArray(resource.queries) && resource.queries.length) {
      return Promise.map(resource.queries, fnExecuteQuery)
    } else {
      return fnExecuteQuery().then(result => [result])
    }
  }

  importMetadata(retsConnection: Models.RetsConnection): IImportMetadataResponse {
    /* istanbul ignore next */
    return new Promise<ImportListingsResponse>((resolve, reject) => {
      let clientSettings = RetsImporterService.mapRetsConnection(retsConnection)
      const service = this.retsClientService
      service.getClient(
        clientSettings,
        (client) => {
          let response: IImportMetadataResponse = {}
          let promise = Promise.resolve(client.metadata.getResources())
            .tap((getResourcesResponse) => {
              response.getResourcesResponse = getResourcesResponse
              response.resources = _.first(getResourcesResponse.results).metadata
            })
            .then(() => {
              let resources = _.filter(response.resources, resource => {
                return resource && resource.ResourceID
              })
              return Promise.map(resources, (resource) => {
                return client.metadata.getClass(resource.ResourceID)
              })
            })
            .tap((getClassResponses) => {
              response.getClassResponses = getClassResponses
              response.classes = _.flatten<RetsClient.IClassMetadata>(
                _.map(getClassResponses, (getClassResponse: RetsClient.IGetClassResponse, index: number) => {
                  return _.map(_.first(getClassResponse.results).metadata, (item: RetsClient.IClassMetadata) => {
                    item._ResourceID = response.resources[index].ResourceID
                    return item
                  })
                })
              )
            })
            .then(() => {
              return Promise.map(response.classes, (item: RetsClient.IClassMetadata) => {
                return client.metadata.getTable(item._ResourceID, item.ClassName)
              })
            })
            .tap((getTableResponses) => {
              response.getTableResponses = getTableResponses
              response.tables = _.flatten(
                _.map(getTableResponses, (getTableResponse) => {
                  return getTableResponse.results
                })
              )
            })
          promise
            .then(() => setImmediate(resolve, response))
            .catch((err) => setImmediate(reject, err))
          return promise
        }).catch((err) => setImmediate(reject, err))
    })
  }
}

export interface IImportMetadataResponse {
  getResourcesResponse?: RetsClient.IGetResourcesResponse
  resources?: RetsClient.IResourceMetadata[]
  getClassResponses?: RetsClient.IGetClassResponse[]
  classes?: RetsClient.IClassMetadata[]
  getTableResponses?: RetsClient.IGetTableResponse[]
  tables?: RetsClient.ITableMetadata[]
}
