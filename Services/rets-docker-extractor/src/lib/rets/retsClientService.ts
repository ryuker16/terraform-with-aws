import * as BPromise from 'bluebird'
import * as RetsClient from 'rets-client'
import { Rets } from 'etl'
import { ILogger } from 'infrastructure-logging-lib'
import * as _ from 'lodash'
import { EventEmitter } from 'events'
import T from '../types'
import { injectable, inject } from 'inversify'
import { doUntil } from 'async'
import * as Rx from 'rx'
Rx.config.Promise = BPromise
import { ImportResourceClassResponse, RetsResponse, RetsErrorCodes, RetsListingRequest } from './interfaces'
/**
 * https://www.flexmls.com/developers/rets/tutorials/dmql-tutorial/
 *
 */
export namespace FieldFormats {
  export const Date = 'YYY-MM-DD'
  export const Time = 'HH:MM:SS'
  export const DateTime = 'YYYY-MM-DDTHH:mm:ss'
}

export interface RetsRequestContext extends ImportResourceClassResponse {
  breakFlag: boolean
}

@injectable()
export class RetsClientService extends EventEmitter {
  constructor(
    @inject(T.RetsStatic) private rets: RetsClient.RetsStatic,
    @inject(T.ILogger) private logger: ILogger) {
    super()
  }
  /**
   * uses getAutoLogoutClient and returns the same promise resolve of callback OR a rejection
   * if login failed to succeed
   */
  getClient<T>(clientSettings: RetsClient.ClientSettings, callback: (client: RetsClient.IClient) => BPromise<T>) {
    let getClientSettings = _.omit(clientSettings, 'password', 'userAgentPassword')
    this.logger.audit('getClient', 'info', { getClientSettings })
    return new BPromise<T>((resolve, reject) => {
      BPromise.resolve(this.rets.getAutoLogoutClient(
        clientSettings,
        (client: RetsClient.IClient) => {
          // in order to have the auto-logout function work properly, we need to
          // make a promise that either rejects or resolves only once we're done
          // processing the stream
          let callbackPromise = BPromise.try(() => callback(client))
          callbackPromise
            .then((data) => setTimeout(resolve, 0, data))
            .catch((err) => setTimeout(reject, 0, err))
          return callbackPromise
        })).catch((err) => setTimeout(reject, 0, err))
    })
  }

  /**
   * entry point to incrementally query RETS server until no more results are returned
   * Optionally, for debugging, if queryOptions.limitCalls is enabled, it will only make n limitCalls
   */
  loadListings(
    client: RetsClient.IClient,
    resourceName: string,
    className: string,
    query: string,
    queryOptions: RetsClient.IQueryOptions): BPromise<ImportResourceClassResponse> {
    let requestContext: Partial<RetsRequestContext> = {
      resourceName,
      className,
      query,
      queryOptions,
      results: [],
      requests: [],
      responses: [],
      breakFlag: false
    }
    this.logger.audit('RetsClientService.loadListings', 'info', { requestContext })

    return BPromise.bind(this)
      .then(() => this.recurseQuery(client, requestContext as RetsRequestContext))
      .catch((err) => {
        this.logger.error(err, { requestContext })
        throw err
      })
  }
  /**
   * @param {string} ids single id, array of id
   * @param {string} photoType HiRes for flex
   */
  importImages(
    client: RetsClient.IClient,
    resourceName: string,
    ids: string | string[],
    photoType: string): BPromise<Rets.RetsImageResponse[]> {
    let options = {
      alwaysGroupObjects: true,
      Location: 1,
      ObjectData: '*'
    }
    return BPromise.bind(this)
      .then(() => BPromise.resolve(client.objects.getAllObjects(
        resourceName, photoType, ids, options))
      )
      .then((photoResults: RetsClient.IGetAllObjectsResponse) => {
        return photoResults.objects
      })
      .catch((err) => {
        this.logger.error(err, { method: 'RetsClientService.importImages', resourceName, ids, photoType })
        throw err
      })
  }
  private retsQuery(client: RetsClient.IClient, requestContext: RetsRequestContext) {
    let retsRequest: RetsListingRequest = {
      resourceName: requestContext.resourceName,
      className: requestContext.className,
      query: requestContext.query,
      queryOptions: requestContext.queryOptions
    }
    this.logger.audit('RetsClientService.retsQuery', 'debug', { retsRequest })
    requestContext.requests.push(_.cloneDeep(retsRequest))
    return BPromise.resolve(client.search.query(
      requestContext.resourceName,
      requestContext.className,
      requestContext.query,
      requestContext.queryOptions))
  }

  private processResponse(
    requestContext: RetsRequestContext,
    queryResponse: RetsClient.IQueryResponse) {
    if (!_.isObjectLike(queryResponse)) {
      requestContext.breakFlag = true
      return requestContext
    }
    let retsResponse = _.omit<RetsResponse, RetsClient.IQueryResponse>(queryResponse, ['results'])
    // log and append the resulting retsResponse
    requestContext.responses.push(retsResponse)
    this.logger.audit(
      'RetsClientService.processResponse',
      'info',
      {
        requestContext: _.omit(requestContext, ['results', 'responses']),
        retsResponse
      })
    if (!_.isArray(queryResponse.results) || !queryResponse.results.length) {
      requestContext.breakFlag = true
      return requestContext
    }
    // append to the results list
    requestContext.results = requestContext.results.concat(queryResponse.results)
    if (_.isNil(requestContext.queryOptions.offset) || requestContext.queryOptions.offsetNotSupported) {
      // offsetNotSupported, only query once
      requestContext.breakFlag = true
      return requestContext
    }
    // increment the offset based on the number of results returned
    requestContext.queryOptions.offset += queryResponse.results.length
    // break the recurseQuery if results returned are lt the per-query limit
    requestContext.breakFlag = queryResponse.results.length < requestContext.queryOptions.limit

    // DEBUG
    if (!requestContext.breakFlag && requestContext.queryOptions.limitCalls) {
      // breakFlag
      requestContext.breakFlag = requestContext.responses.length >= requestContext.queryOptions.limitCalls
    }
    return requestContext
  }
  private processRetsReplyError(retsError: RetsClient.RetsReplyError, requestContext: RetsRequestContext) {
    if (retsError.replyCode && retsError.replyCode === RetsErrorCodes.NO_RECORDS_FOUND.toString()) {
      requestContext.responses.push({
        isError: true,
        retsError
      })
      requestContext.breakFlag = true
      return requestContext
    } else {
      throw retsError
    }
  }

  /**
   * recurseQuery passes the mutable requestContext throughout multiple calls
   * to perform rets queries until the breakFlag is set to true
   * @returns RequestContext
   */
  private recurseQuery(client: RetsClient.IClient, requestContext: RetsRequestContext): BPromise<RetsRequestContext> {
    const performQuery = (callback: ErrorCallback<any>) => {
      setTimeout(
        () => {
          return BPromise.bind(this)
            .then(() => this.retsQuery(client, requestContext))
            .then((retsResponse) => this.processResponse(requestContext, retsResponse))
            .catch(RetsClient.RetsReplyError, (err) => this.processRetsReplyError(err, requestContext))
            .asCallback(callback)
        },
        0)
    }
    return BPromise.fromCallback(function (callback) {
      doUntil(
        performQuery,
        function recurseQueryTest() {
          return requestContext.breakFlag
        },
        callback)
    })
      // return the final requestcontext
      .then(() => requestContext)
      // throw OperationalError.cause to handle fromCallback
      .error(function (err: BPromise.OperationalError) { throw err.cause })
  }
}
