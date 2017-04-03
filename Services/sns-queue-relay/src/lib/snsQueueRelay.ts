import { ILogger } from 'infrastructure-logging-lib'
import * as config from 'config'
import * as crypto from 'crypto'
import * as AWS from 'aws-sdk'
import * as BPromise from 'bluebird'
import * as _ from 'lodash'

export interface PublishMessageResult {
  MessageId: string
}

export class SNSQueueRelay {
  queueUrl: string

  constructor(
    private queue: AWS.SQS,
    config: config.IConfig,
    private logger: ILogger
  ) {
    this.queueUrl = config.get<string>('snsQueueRelay.queueUrl')
  }

  relay(event: AwsContracts.SnsPublishedMessages<AwsContracts.S3EventRecords>): BPromise<any> {
    return BPromise.bind(this)
      .then(() => {
        return _.flatMap(this.unpackSNSRecords(event), (S3EventRecords) => {
          return this.unpackS3Records(S3EventRecords)
        })
      })
      .then((s3Records: Array<AwsContracts.S3EventRecordMessage>) => BPromise.map(s3Records, (record) => {
        return this.addMessageToQueue(record)
      }))
  }

  unpackSNSRecords(event: AwsContracts.SnsPublishedMessages<AwsContracts.S3EventRecords>): Array<AwsContracts.S3EventRecords> {
    return event.Records.map((record: AwsContracts.SnsEventRecord<any>) => {
      return JSON.parse(record.Sns.Message)
    })
  }

  unpackS3Records(event: AwsContracts.S3EventRecords): Array<AwsContracts.S3EventRecordMessage> {
    return event.Records.map((record: AwsContracts.S3EventRecordMessage) => record)
  }

  generateDeduplicationID(record: AwsContracts.S3EventRecordMessage): string {
    return crypto.createHash('md5').update(`${record.s3.bucket.arn}:${record.s3.object.key}`).digest('hex')
  }

  addMessageToQueue(record: AwsContracts.S3EventRecordMessage): BPromise<Partial<PublishMessageResult>> {
    const message = {
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(record),
      MessageGroupId: record.s3.bucket.name,
      MessageDeduplicationId: this.generateDeduplicationID(record)
    } as AWS.SQS.Types.SendMessageRequest

    return BPromise.resolve(this.queue.sendMessage(message).promise())
      .catch((err) => {
        this.logger.error(err)
        throw err
      })
  }
}
