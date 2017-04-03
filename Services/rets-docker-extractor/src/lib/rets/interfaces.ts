import * as RetsClient from 'rets-client'
import { Models, ResoType, Contracts, Context, Rets } from 'etl'
import { SNS } from 'aws-sdk'
import * as Rx from 'rx'

type RetsResult = RetsClient.IResource
interface RetsErrorResponse {
  isError: true
  retsError: RetsClient.IRetsError
}
export type RetsResponse = RetsClient.IQueryResponse | RetsErrorResponse
export enum RetsErrorCodes {
  NO_RECORDS_FOUND = 20201,
  NO_OBJECT_FOUND = 20403
}

export interface IRetsClientServiceEvent {
  err: RetsClient.RetsError
}
export interface ResourceClassResponse {
  resoType: ResoType
  resourceName: string
  className: string
  /** array of each RETS document */
  results: RetsResult[]
  /** rets client error, if any */
  err?: Error
  /**
   * Class configuration initiating the query
   */
  classModel: Models.ClassResource
  /** aggregate of each HTTP RETS request */
  requests?: RetsListingRequest[]
  /** aggregate array of each HTTP RETS response */
  responses?: RetsResponse[]
  /** previous RetsQueryStats used to execute the request, if any */
  retsQueryStat?: Models.RetsQueryStats
}

export interface RetsListingRequest {
  resourceName: string
  className: string
  query: string
  queryOptions: RetsClient.IQueryOptions
}

export interface ImportResourceClassResponse extends ResourceClassResponse {
  /** query string passed to rets client */
  query: string
  /**
   * Query model type and behavior initiating the query
   */
  queryModel?: Models.IQuery
  /**
   * rets client query options initiating the query
   */
  queryOptions: RetsClient.IQueryOptions
}

export interface ResourceClassResponseReduced extends ResourceClassResponse {
  /**
   * Aggregate query models type and behaviors
   */
  queryModels?: Models.IQuery[]
  /**
   * rets client query options initiating the query
   */
  queryOptions?: RetsClient.IQueryOptions[]
}

export interface ResourceClassImagesResponse extends ResourceClassResponseReduced {
  /**
   * Tuple of each rets document and associated images
   */
  retsDocumentImagesTuples: RetsDocumentImagesTuple[]
}

export interface ImportListingsResponse {
  resources: ImportResourceResponse[]
}

export interface ImportResourceResponse {
  resoType: ResoType
  classes: ResourceClassResponse[]
}

export interface ExportListingResponse {
  retsDocumentExtracted?: Contracts.RetsDocumentExtracted
  err?: any
}

export interface RetsDocumentImagesTuple {
  retsDocumentBody: RetsResult
  retsDocumentImages: Rets.RetsImageResponse[]
  /** sourced from the retsQueryFields.uniqueIdField value */
  retsDocumentId?: string
}

Rx.config.Promise = Promise
declare module 'rx' {
  export interface Observable<T> {
    // alias for selectMany
    // http://xgrommx.github.io/rx-book/content/observable/observable_instance_methods/flatmapwithmaxconcurrent.html
    flatMapWithMaxConcurrent<TOther, TResult>(
      concurrent: number,
      selector: (value: T) => IPromise<TOther> | Observable<TOther>,
      resultSelector: (item: T, other: TOther, itemIndex?: number, otherIndex?: number) => TResult,
      thisArg?: any): Observable<TResult>
    flatMapWithMaxConcurrent<TResult>(
      concurrent: number,
      selector: (value: T) => IPromise<TResult> | Observable<TResult>,
      thisArg?: any): Observable<TResult>
  }
  type IObservableOrPromise<T> = Observable<T> | IPromise<T>
  export interface ObservableStatic {
    defer<T>(factory: () => IObservableOrPromise<T>): Observable<T>
    mergeDelayError<T>(...sources: IObservable<T>[]): Observable<T>
  }
}
