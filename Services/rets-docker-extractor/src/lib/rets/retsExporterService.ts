// import { inject, injectable } from 'inversify'
// import T from '../types'
import { Extraction, Contracts, Rets } from 'etl'
import * as BPromise from 'bluebird'
import * as AWS from 'aws-sdk'
import * as RetsClient from 'rets-client'
import { ILogger } from 'infrastructure-logging-lib'
import * as shortid from 'shortid'
import * as _ from 'lodash'
import * as Rx from 'rx'
import {
  ImportListingsResponse, ResourceClassResponse, ImportResourceClassResponse, RetsDocumentImagesTuple,
  ExportListingResponse, ResourceClassImagesResponse
} from './interfaces'
import * as config from 'config'

export const REGION = config.has('region')
  ? config.get<string>('region') || 'us-east-1'
  : 'us-east-1'

export const PERIOD_FORMAT = config.has('RetsExporterService.periodFormat')
  ? config.get<string>('RetsExporterService.periodFormat') || 'YYYY-MM-DD-HH-mm'
  : 'YYYY-MM-DD-HH-mm'

export function RetsExporterServiceFactory(request: Extraction.Request, logger: ILogger): RetsExporterService {
  return new RetsExporterService(
    new AWS.Firehose({ region: REGION }),
    logger)
}

export function isResourceClassImageResponse(
  response: ResourceClassResponse): response is ResourceClassImagesResponse {
  if (Array.isArray((response as ResourceClassImagesResponse).retsDocumentImagesTuples)) {
    return true
  }
  return false
}

export function getResourceClassResponseResults(
  response: ResourceClassResponse) {
  if (isResourceClassImageResponse(response)) {
    return response.retsDocumentImagesTuples
  } else {
    return _.map(response.results, function (retsDocumentBody) {
      return { retsDocumentBody, retsDocumentImages: [] } as RetsDocumentImagesTuple
    })
  }
}

export function projectToDecoratedRetsDocumentImagesTuple(classResponse: ResourceClassResponse, tuple: RetsDocumentImagesTuple) {
  return {
    retsDocumentBody: tuple.retsDocumentBody,
    retsDocumentImages: tuple.retsDocumentImages,
    className: classResponse.className,
    resourceName: classResponse.resourceName,
    purchaseType: classResponse.classModel
      ? classResponse.classModel.purchaseType
      : null
  } as RetsDocumentImagesTuple
}

export function isRetsDocumentImagesTuple(result: RetsClient.IResource | RetsDocumentImagesTuple): result is RetsDocumentImagesTuple {
  return result && !_.isNil((result as RetsDocumentImagesTuple).retsDocumentBody)
}

const FIREHOSE_BUFFER_COUNT = parseInt(config.get<string>('RetsExporterService.firehoseBufferCount'), 10)
const FIREHOSE_CONCURRENCY = parseInt(config.get<string>('RetsExporterService.firehoseConcurrency'), 10)

export class RetsExporterService {
  static EXPORT_BUCKET = config.get<string>('RetsExporterService.bucket')
  static RESOURCE_CONCURRENCY = parseInt(config.get<string>('RetsExporterService.resourceConcurrency'), 10)
  static CLASS_CONCURRENCY = parseInt(config.get<string>('RetsExporterService.classConcurrency'), 10)
  static RESULT_CONCURRENCY = parseInt(config.get<string>('RetsExporterService.resultConcurrency'), 10)
  static DELIVERY_STREAM_NAME = config.get<string>('RetsExporterService.DeliveryStreamName')
  /**
   * Each PutRecordBatch request supports up to 500 records. Each record in the request can be as large as 1,000 KB (before 64-bit encoding),
   * up to a limit of 4 MB for the entire request. These limits cannot be changed.
   * We have estimated RetsDocumentExtracted to be max 100KB aka .1MB
   * 4MB limit / .1MB = Optimal putRecordBatch bufferCount of 40
   */
  public FIREHOSE_BUFFER_COUNT: number
  public FIREHOSE_CONCURRENCY: number
  constructor(
    private firehose: AWS.Firehose,
    private logger: ILogger) {
    this.FIREHOSE_BUFFER_COUNT = FIREHOSE_BUFFER_COUNT
    this.FIREHOSE_CONCURRENCY = FIREHOSE_CONCURRENCY
  }

  static getRetsDocumentMetadata(
    extractionRequest: Extraction.RetsRequest,
    listingResponse: ResourceClassResponse
  ): Rets.RetsDocumentMetadata {
    let correlationID = extractionRequest.context.correlationID
    let scheduleId = extractionRequest.context.scheduleId
    let resoType = listingResponse.resoType
    let importId = extractionRequest.config.importId
    let className = listingResponse.className
    let period = extractionRequest.context.period
    return _.assign(
      {
        resoType: resoType,
        resourceName: listingResponse.resourceName,
        className,
        importId,
        period,
        correlationID,
        scheduleId,
        providerId: extractionRequest.config.providerId,
        purchaseType: listingResponse.classModel.purchaseType
      },
      extractionRequest.context)
  }

  static getRetsDocumentImagesTuple(result: RetsClient.IResource | RetsDocumentImagesTuple): RetsDocumentImagesTuple {
    return isRetsDocumentImagesTuple(result)
      ? result
      : { retsDocumentBody: result, retsDocumentImages: [] } as RetsDocumentImagesTuple
  }

  static buildPutObjectRequest(
    extractionRequest: Extraction.RetsRequest,
    resourceClassResponse: ResourceClassResponse,
    document: RetsDocumentImagesTuple): AWS.S3.Types.PutObjectRequest {
    let context = extractionRequest.context
    let resoType = resourceClassResponse.resoType
    let importId = extractionRequest.config.importId
    let resourceName = resourceClassResponse.resourceName
    let className = resourceClassResponse.className
    let period = extractionRequest.context.period
    let structure = [resoType, importId, resourceName, className, period]
    let path = structure.join('/')
    let filename = [shortid.generate(), className, resourceName, importId, resoType].join('__')
    let key = `${path}/${filename}.json`
    let retsDocumentMetadata = RetsExporterService.getRetsDocumentMetadata(extractionRequest, resourceClassResponse)
    // build the body as { retsDocumentBody, retsDocumentImages, context, retsDocumentMetadata }
    let extractedBody: Partial<Contracts.RetsDocumentExtracted> = _.assign({}, document, { context, retsDocumentMetadata })
    return {
      Bucket: RetsExporterService.EXPORT_BUCKET,
      Key: key,
      Body: JSON.stringify(extractedBody),
      Metadata: retsDocumentMetadata,
      ContentType: 'application/json'
    }
  }

  /**
   * Top level function to export all resource and classe documents & images from an import
   * PseudoCode
   */
  exportListings(
    extractionRequest: Extraction.RetsRequest,
    importedListings: ImportListingsResponse) {
    if (!extractionRequest) { return BPromise.reject(new TypeError('Extraction.Request')) }
    if (!importedListings) { return BPromise.reject(new TypeError('ImportListingsResponse')) }
    let maxConcurrent = this.FIREHOSE_CONCURRENCY
    let bufferCount = this.FIREHOSE_BUFFER_COUNT
    let source = Rx.Observable.fromArray(importedListings.resources || [])
      .flatMap<ResourceClassResponse>((resource) => Rx.Observable.fromArray(resource.classes || []))
      .flatMap(
      // map each property from the ResourceClassResponse
      (classResponse: ResourceClassResponse) => Rx.Observable.fromArray(getResourceClassResponseResults(classResponse)),
      // project each property from the ResourceClassResponse with ResourceClassResponse context
      (classResponse: ResourceClassResponse, tuple: RetsDocumentImagesTuple) => projectToDecoratedRetsDocumentImagesTuple(classResponse, tuple))
      // map to a RetsDocumentExtracted payload for each property
      .map<Contracts.RetsDocumentExtracted>((value: RetsDocumentImagesTuple) => {
        return this.buildRetsDocumentExtractedFromTuple(extractionRequest, value)
      })
      // chunk the batch size sent to each putRecordBatch
      .bufferWithCount(bufferCount)
      // throttle concurrent connections to firehose
      .flatMapWithMaxConcurrent(
      maxConcurrent,
      (extractionRequests: Contracts.RetsDocumentExtracted[]) => Rx.Observable.defer(() => {
        return BPromise.try(() => this.putExtractionRequestBatchToFirehose(extractionRequests))
      }))
    return source.toPromise(BPromise)
  }

  /**
   * @deprecated
   */
  exportResourceClass(
    extractionRequest: Extraction.RetsRequest,
    listings: ImportListingsResponse,
    classResponse: ResourceClassResponse) {
    /* istanbul ignore next */
    return Rx.Observable.fromArray(getResourceClassResponseResults(classResponse))
      .flatMapWithMaxConcurrent(
      // maxConcurrent
      RetsExporterService.RESULT_CONCURRENCY,
      // deferred selector
      (document) => Rx.Observable.defer(() => {
        return this.exportListing(extractionRequest, classResponse, document)
          .catch((err) => {
            this.logger.error(err, extractionRequest.context)
            return _.extend({}, extractionRequest, { err }) as ExportListingResponse
          })
      }))
  }

  /**
   * @deprecated
   */
  exportResourceClassImageResponse(
    extractionRequest: Extraction.RetsRequest,
    listings: ImportListingsResponse,
    classResponse: ResourceClassImagesResponse) {
    /* istanbul ignore next */
    return Rx.Observable.from(
      classResponse.retsDocumentImagesTuples || [],
      (document) => {
        return BPromise.try(() => {
          return this.exportListing(extractionRequest, classResponse, document)
        }).catch((err) => {
          this.logger.error(err, extractionRequest.context)
          return _.extend({}, extractionRequest, { err }) as ExportListingResponse
        })
      })
  }

  /**
   * @deprecated
   */
  exportListing(
    extractionRequest: Extraction.RetsRequest,
    classResponse: ResourceClassResponse,
    document: RetsDocumentImagesTuple): BPromise<ExportListingResponse> {
    /* istanbul ignore next */
    let retsDocument = RetsExporterService.getRetsDocumentImagesTuple(document)
    let putObjectRequest = RetsExporterService.buildPutObjectRequest(extractionRequest, classResponse, retsDocument)
    let retsDocumentMetadata = RetsExporterService.getRetsDocumentMetadata(extractionRequest, classResponse)
    let bucket = putObjectRequest.Bucket
    let key = putObjectRequest.Key
    let retsDocumentExtracted = this.buildRetsDocumentExtractedNotification(
      extractionRequest,
      retsDocumentMetadata,
      document,
      bucket,
      key)
    this.logger.audit('RetsExporterService.exportListing', 'info', _.assign(extractionRequest.context, { retsDocumentMetadata }))
    return BPromise.bind(this)
      .thenReturn({ retsDocumentExtracted })
  }

  buildRetsDocumentExtractedFromTuple(request: Extraction.RetsRequest, tuple: RetsDocumentImagesTuple): Contracts.RetsDocumentExtracted {
    return _.merge(tuple, request) as Contracts.RetsDocumentExtracted
  }

  putExtractionRequestBatchToFirehose(requests: Contracts.RetsDocumentExtracted[]) {
    if (requests && requests.length) {
      this.logger.telemetry('RetsExporterService.putRecordBatch', 'records', 'count', requests.length, requests[0].context)
    }
    let putRecordBatchParams = {
      DeliveryStreamName: RetsExporterService.DELIVERY_STREAM_NAME,
      Records: _.map(requests, (r) => {
        return { Data: JSON.stringify(r) }
      })
    }

    return BPromise.resolve(this.firehose.putRecordBatch(putRecordBatchParams).promise())
  }

  /**
   * @deprecated - putExtractionReqestBatchToFirehose instead
   */
  private buildRetsDocumentExtractedNotification(
    request: Extraction.RetsRequest,
    retsDocumentMetadata: Rets.RetsDocumentMetadata,
    document: RetsDocumentImagesTuple,
    bucket: string,
    key: string
  ): Contracts.RetsDocumentExtracted {
    /* istanbul ignore next */
    let retsDocumentBody = isRetsDocumentImagesTuple(document)
      ? document.retsDocumentBody
      : document

    let retsDocumentImages = isRetsDocumentImagesTuple(document)
      ? document.retsDocumentImages
      : []

    return _.assign({}, request, {
      retsDocumentLocation: {
        region: REGION,
        bucket: bucket,
        key: key
      },
      className: retsDocumentMetadata.className,
      resourceName: retsDocumentMetadata.resourceName,
      retsDocumentBody,
      retsDocumentMetadata,
      retsDocumentImages
    })
  }
}
