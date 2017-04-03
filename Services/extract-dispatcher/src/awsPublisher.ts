import * as AWS from 'aws-sdk'
import { ILogger } from 'etl'
import * as Promise from 'bluebird'

export interface PublishMessageResult {
  MessageId: string
}

export class AWSPublisher {

  constructor(
    private sqsClient: AWS.SQS,
    private logger: ILogger) {
  }

  public publishMessage(message: any, queueUrl: string): Promise<Partial<PublishMessageResult>> {
    let publishMsg = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message)
    } as AWS.SQS.Types.SendMessageRequest

    return Promise.resolve(this.sqsClient.sendMessage(publishMsg).promise())
      .catch((err) => {
        this.logger.error(err)
        throw err
      })
  }

  publishMessages(messages: any[], queueUrl: string) {
    return Promise.bind(this)
      .then(() => Promise.map(messages, message => {
        return this.publishMessage(message, queueUrl)
      }))
  }
}
