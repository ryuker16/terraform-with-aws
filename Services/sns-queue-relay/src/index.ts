/// <reference path="../definitions/index.d.ts" />
import { Contracts } from 'etl'
import * as AWS from 'aws-sdk'
import * as config from 'config'
import { getDefault } from './config'
import { Aws } from 'infrastructure-node-cloudservices-lib'
import { getLogger, ILogger, ILoggerImplementationOptions, getConsoleStream } from 'infrastructure-logging-lib'
import { wirePrototypeMethodAsync, wireMethodAsync } from 'infrastructure-nodeaspect-lib'

import { SNSQueueRelay } from './lib/snsQueueRelay'

const region = getDefault('region', 'us-east-1')

AWS.config.update({ region })
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  sns: '2010-03-31',
  lambda: '2015-03-31',
  s3: '2006-03-01'
}

const wirePrototypeMethodAsyncWrapped = function (c: any, method: string, logger: ILogger) {
  /* istanbul ignore next */
  if (process.env.NODE_ENV === 'test') {
    return
  }
  /* istanbul ignore next */
  return wirePrototypeMethodAsync(c, method, logger)
}

const wireMethodAsyncWrapped = function (c: any, method: string, logger: ILogger) {
  /* istanbul ignore next */
  if (process.env.NODE_ENV === 'test') {
    return
  }
  /* istanbul ignore next */
  return wireMethodAsync(c, method, logger)
}

export function handler(
  event: AwsContracts.SnsPublishedMessages<any>,
  lambdaContext: AwsLambda.Context,
  callback: Function) {
  /* istanbul ignore next */
  const appName = `etl-${process.env.NODE_ENV || 'development'}`
  const serviceName = lambdaContext.functionName || 'sns-queue-relay'
  let context = {
    awsRequestId: lambdaContext.awsRequestId
  }
  const logger = getLogger(appName, serviceName, context, {
    streams: [getConsoleStream()]
  })

  wirePrototypeMethodAsyncWrapped(SNSQueueRelay.prototype as any, 'relay', logger)
  const relayService = new SNSQueueRelay(new AWS.SQS(), config, logger)
  wireMethodAsyncWrapped(relayService, 'selfInvokeAsync', logger)
  return relayService.relay(event).asCallback(callback)
}
