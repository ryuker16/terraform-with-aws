import { Contracts } from 'etl'
import { Queues } from 'infrastructure-node-cloudservices-lib'
import { SQS } from 'aws-sdk'
import { Db } from 'mongodb'
/**
 * Lambda receives from SQS queue with body of an SNS published message for
 * RetsStatsAvailable
 */
export interface TMessageData extends AwsContracts.SnsPublishedMessage<Contracts.RetsStatsAvailable> {
}
export interface TMessage extends Queues.IQueueMessageOf<TMessageData, SQS.Types.Message> {
}
export interface IDbResponse {
  collection?: string
  operation?: string
  modifiedCount?: number
  upsertedCount?: number
  interstedCount?: number
}

export interface IImportRepository {
  updateRetsQueryStats(retsStatsAvailable: Contracts.RetsStatsAvailable, db: Db): PromiseLike<IDbResponse>
  updateRetsQueryStatsBatch(retsStatsAvailable: Contracts.RetsStatsAvailable[], db: Db): PromiseLike<IDbResponse>
}
