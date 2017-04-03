import { Lambda, S3 } from 'aws-sdk'
import { Contracts, CallbackOf, HashMapOf } from 'etl'
import { TMessage, TMessageData, IS3Object, IDeliveryStreamS3RecordsExtractor } from './interfaces'
import { ILogger } from 'infrastructure-logging-lib'
import * as BPromise from 'bluebird'
import * as _ from 'lodash'
import * as config from 'config'
import * as Rx from 'rx'

export class DeliveryStreamS3RecordsExtractor implements IDeliveryStreamS3RecordsExtractor {
  constructor(
    private logger: ILogger,
    private s3: S3
  ) {
    if (!logger) {
      throw new TypeError('logger')
    }
    if (!s3 || !_.isFunction(s3.getObject)) {
      throw new TypeError('s3')
    }
  }

  extractRecords<TRecord>(obj: IS3Object): Rx.Observable<TRecord> {
    let recordsPromise = BPromise.bind(this)
      .then(() => this.getS3ObjectContent(obj))
      .then((content) => this.parseS3ObjectRecords<TRecord>(content))
    return Rx.Observable.fromPromise(recordsPromise)
      .flatMap(records => Rx.Observable.from(records))
  }

  /**
   * Extracts string content from an S3 object
   */
  getS3ObjectContent(obj: IS3Object): Promise<string> {
    const params: S3.Types.GetObjectRequest = {
      Bucket: obj.bucket,
      Key: obj.key
    }
    this.logger.audit('Retreiving S3 object for extraction.', 'info', params)
    return this.s3.getObject(params).promise()
      .then((getObjectOutput: S3.Types.GetObjectOutput) => {
        if (_.isString(getObjectOutput.Body)) {
          return getObjectOutput.Body
        }
        if (getObjectOutput.Body instanceof Buffer) {
          return getObjectOutput.Body.toString()
        }
        throw new Error('Body is not string or Buffer')
      })
  }

  parseS3ObjectRecords<TRecord>(content: string): TRecord[] {
    const records = _.split(content, '}{')
    const recordsJoined = records.join('},{')
    return JSON.parse(`[${recordsJoined}]`) as TRecord[]
  }
}
