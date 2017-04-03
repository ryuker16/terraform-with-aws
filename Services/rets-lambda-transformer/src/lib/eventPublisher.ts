import * as AWS from 'aws-sdk'
import * as Promise from 'bluebird'

export class EventPublisher {

  constructor(public client: AWS.SNS) { }

  publish(topicArn: string, message: any): Promise<AWS.SNS.Types.PublishResponse> {
    let params: AWS.SNS.Types.PublishInput = {
      Message: JSON.stringify(message),
      TargetArn: topicArn
    }
    return Promise.resolve(this.client.publish(params).promise())
  }
}
