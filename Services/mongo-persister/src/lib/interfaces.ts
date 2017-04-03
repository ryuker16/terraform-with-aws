import { Contracts } from 'etl'
import { Queues } from 'infrastructure-node-cloudservices-lib'
import { SQS } from 'aws-sdk'
import * as Rx from 'rx'
import * as Promise from 'bluebird'

export type TMessageData = TRetsDocumentsTransformedFromFirehose | TRetsDocumentTransformedFromSns | TRetsDocumentsTransformedFromFirehoseRelayed

export interface TMessage extends Queues.IQueueMessageOf<TMessageData, SQS.Types.Message> {
}

/**
 * SQS Message body when Transformer triggered SNS directly with RetsDocumentTransformed payload
 * @deprecated
 */
export interface TRetsDocumentTransformedFromSns extends AwsContracts.SnsPublishedMessage<Contracts.RetsDocumentTransformed> {

}

/**
 * SQS message body when Firehose outputs S3 documents that triggers SNS to SNS to SQS
 */
export interface TRetsDocumentsTransformedFromFirehose extends AwsContracts.SnsPublishedMessage<AwsContracts.S3EventRecords> {
}

/**
 * SQS message body when S3 documents triggers SNS to SnsQueueRelay Lambda to SQS
 */
export interface TRetsDocumentsTransformedFromFirehoseRelayed extends AwsContracts.S3EventRecordMessage {
}

export interface IS3Object {
  bucket: string
  key: string
}

export interface IDeliveryStreamS3RecordsExtractor {

  /**
   * extractRecords from a firehose deliverystream IS3Object as type TRecord
   * @returns an Observable sequence of TRecord
   */
  extractRecords<TRecord>(s3Obj: IS3Object): Rx.Observable<TRecord>
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
