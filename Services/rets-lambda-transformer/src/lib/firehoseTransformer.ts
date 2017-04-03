import * as Promise from 'bluebird'
import { Contracts, IQueueMessage, HashMap, Context, Legacy } from 'etl'
import { DocumentTransformer } from './documentTransformer'
import { Aws } from 'infrastructure-node-cloudservices-lib'
import { ILogger } from 'infrastructure-logging-lib'
import * as config from 'config'
import * as async from 'async'
import { isNumber, isBoolean, isFunction } from 'lodash'

export interface TransformationResult<T> {
  drop?: boolean
  err?: any
  data: T
}

export interface ITransformation<TSource, TDest> {
  (record: TSource): Promise<TransformationResult<TDest>>
}
export function FirehoseTransformerFactory<TSource, TDest>(transformation: ITransformation<TSource, TDest>) {
  return new FirehoseTransformer(transformation)
}

export const MAX_CONCURRENT = parseInt(config.get<string>('FirehoseTransformer.maxConcurrent'), 10)

export class FirehoseTransformer<TSource, TDest> {

  maxConcurrent: number

  constructor(
    public transformation: ITransformation<TSource, TDest>,
    maxConcurrent?: number
  ) {
    if (!isFunction(transformation)) { throw new TypeError('transformation is not a function') }
    this.maxConcurrent = isNumber(maxConcurrent) ? maxConcurrent : MAX_CONCURRENT
  }

  /**
   * map the records array from firehose and trigger each record to be transformed aka processed
   */
  processFirehoseRecords(event: AwsContracts.FirehoseRecords): Promise<AwsContracts.FirehoseProcessedRecords> {
    return Promise.fromCallback(callback => {
      async.mapLimit(
        event.records,
        this.maxConcurrent,
        (record, iteratorCallback) => Promise.try(() => this.processFirehoseRecord(record)).asCallback(iteratorCallback),
        callback)
    }).then(records => {
      return { records }
    })
  }

  /**
   * map each record to a customized transormation method
   * and handle the base64 encoding/decoding of the result and or error at top level
   */
  processFirehoseRecord(record: AwsContracts.FirehoseRecord) {
    return Promise.try(() => {
      const payload = new Buffer(record.data, 'base64').toString('ascii')
      const rde = JSON.parse(payload) as TSource
      return this.transformation(rde)
    }).then((transformationResult: TransformationResult<TDest>) => {
      let result = ''
      let data = ''
      if (transformationResult.err) {
        result = 'ProcessingFailed'
        data = new Buffer(JSON.stringify(transformationResult.err)).toString('base64')
      } else if (isBoolean(transformationResult.drop) && transformationResult.drop) {
        result = 'Dropped'
        data = ''
      } else {
        result = 'Ok'
        data = new Buffer(JSON.stringify(transformationResult.data || {})).toString('base64')
      }
      return { recordId: record.recordId, result, data }
    }).catch((err) => {
      return {
        recordId: record.recordId,
        result: 'ProcessingFailed',
        data: new Buffer(JSON.stringify(err)).toString('base64')
      }
    })
  }
}
