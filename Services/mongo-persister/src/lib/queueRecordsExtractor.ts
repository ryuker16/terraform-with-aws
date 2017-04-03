import { Contracts } from 'etl'
import {
  IDeliveryStreamS3RecordsExtractor,
  TRetsDocumentTransformedFromSns,
  TRetsDocumentsTransformedFromFirehose,
  TRetsDocumentsTransformedFromFirehoseRelayed
} from './interfaces'
import { SQS } from 'aws-sdk'
import { Queues, Aws } from 'infrastructure-node-cloudservices-lib'
import * as _ from 'lodash'
import * as Rx from 'rx'
import { } from './deliveryStreamS3RecordsExtractor'

export interface SqsMessageOf<T> extends Queues.IQueueMessageOf<T, SQS.Types.Message> {

}

/**
 * Service to retrieve RetsDocumentTransformed payloads from incoming SQS messages
 */
export class QueueRecordsExtractor {
  constructor(
    private recordsExtractor: IDeliveryStreamS3RecordsExtractor
  ) {
    if (!recordsExtractor || !_.isFunction(recordsExtractor.extractRecords)) {
      throw new TypeError('DeliveryStreamS3RecordsExtractor')
    }
  }

  /**
   * @returns true if the queue Message parsed signifies from Firehose > S3 > SNS<S3EventRecordMessage> > SQS(SNS(S3EventRecordMessage))
   */
  static isRetsDocumentsTransformedFromFirehose(message: SqsMessageOf<any>): message is SqsMessageOf<TRetsDocumentsTransformedFromFirehose> {
    return _.has(message.Data, 'Type') &&
      (message.Data as TRetsDocumentsTransformedFromFirehose).Type === 'Notification' &&
      (message.Data as TRetsDocumentsTransformedFromFirehose).Message.indexOf('aws:s3') > 0
  }

  /**
   * @returns true if the queue Message parsed signifies from Transformer > SNS(RetsDocumentTransformed) > SQS(SNS(RetsDocumentTransformed))
   * @deprecated
   */
  static isRetsDocumentTransformedFromSns(message: SqsMessageOf<any>): message is SqsMessageOf<TRetsDocumentTransformedFromSns> {
    return _.has(message.Data, 'Type') &&
      (message.Data as TRetsDocumentTransformedFromSns).Type === 'Notification' &&
      (message.Data as TRetsDocumentTransformedFromSns).Message.indexOf('transformedDocumentBody') > 0
  }

  /**
   * @returns true if the queue Message parsed signifies Firehose > S3 > SNS<S3EventRecordMessage> > SnsQueueRelay lambda > SQS<S3EventRecordMessage>
   */
  static isRetsDocumentsTransformedFromFirehoseRelayed(message: SqsMessageOf<any>): message is SqsMessageOf<TRetsDocumentsTransformedFromFirehoseRelayed> {
    return _.has(message.Data, 'eventSource') &&
      (message.Data as TRetsDocumentsTransformedFromFirehoseRelayed).eventSource === 'aws:s3' &&
      _.has(message.Data, 's3.bucket.name') &&
      _.has(message.Data, 's3.object.key')
  }

  /**
   * @returns an Observable of RetsDocumentTransformed from a queue message
   * that either contains a 1-1 SNS>RetsDocumentTransformed (pre-firehose)
   * OR retrieves documents form the recordsExtractor from firehose->s3->sns->sqs
   */
  sourceRetsDocumentTransformed(message: SqsMessageOf<any>): Rx.Observable<Contracts.RetsDocumentTransformed> {
    if (QueueRecordsExtractor.isRetsDocumentsTransformedFromFirehoseRelayed(message)) {
      let s3EventRecordMessage = message.Data as AwsContracts.S3EventRecordMessage
      return this.recordsExtractor.extractRecords<Contracts.RetsDocumentTransformed>({
        bucket: s3EventRecordMessage.s3.bucket.name,
        key: s3EventRecordMessage.s3.object.key
      })
    }
    if (QueueRecordsExtractor.isRetsDocumentsTransformedFromFirehose(message)) {
      let s3EventRecords = message.Data.Data = JSON.parse(message.Data.Message)
      return Rx.Observable.from(s3EventRecords.Records)
        .concatMap((s3EventRecordMessage: AwsContracts.S3EventRecordMessage) => {
          return this.recordsExtractor.extractRecords<Contracts.RetsDocumentTransformed>({
            bucket: s3EventRecordMessage.s3.bucket.name,
            key: s3EventRecordMessage.s3.object.key
          })
        })
    }
    if (QueueRecordsExtractor.isRetsDocumentTransformedFromSns(message)) {
      let rdt = JSON.parse(message.Data.Message)
      message.Data.Data = rdt
      return Rx.Observable.just(rdt)
    }
    throw new Error('Cannot extract records from message')
  }
}
