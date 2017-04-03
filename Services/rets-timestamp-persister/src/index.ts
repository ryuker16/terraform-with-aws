/// <reference path="../definitions/index.d.ts" />
import { Contracts } from 'etl'
import * as AWS from 'aws-sdk'
import * as config from 'config'
import { getDefault, getDefaultInt } from './config'
import { Aws, Queues } from 'infrastructure-node-cloudservices-lib'
import { MongoClient } from 'mongodb'
import { IOptions, RetsTimestampPersister } from './lib/retsTimestampPersister'
import { getLogger, ILogger, ILoggerImplementationOptions, getConsoleStream } from 'infrastructure-logging-lib'
import { wirePrototypeMethodAsync, wireMethodAsync } from 'infrastructure-nodeaspect-lib'
import * as BPromise from 'bluebird'
import { ImportRepository } from './lib/importRepository'

const region = getDefault('region', 'us-east-1')
const queueBatchSize = getDefaultInt('retsTimestampPersister.queueBatchSize', 10)
const remainingMillisThreshold = getDefaultInt('retsTimestampPersister.remainingMillisThreshold', 5000)

AWS.config.setPromisesDependency(BPromise)
AWS.config.update({ region })
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  sns: '2010-03-31',
  lambda: '2015-03-31',
  s3: '2006-03-01'
}

const wirePrototypeMethodAsyncWrapped = function (c: any, method: string, logger: ILogger) {
  /* istanbul ignore if */
  if (process.env.NODE_ENV === 'test') {
    return
  }
  /* istanbul ignore next */
  return wirePrototypeMethodAsync(c, method, logger)
}

const wireMethodAsyncWrapped = function (c: any, method: string, logger: ILogger) {
  /* istanbul ignore if */
  if (process.env.NODE_ENV === 'test') {
    return
  }
  /* istanbul ignore next */
  return wireMethodAsync(c, method, logger)
}

export function handler(
  event: Contracts.RetsDocumentExtracted,
  lambdaContext: AwsLambda.Context,
  callback: Function) {

  const appName = `etl-${process.env.NODE_ENV || 'development'}`
  const serviceName = lambdaContext.functionName || 'rets-timestamp-persister'
  let loggerImplementation: Partial<ILoggerImplementationOptions> = {}
  let token = getDefault('logentries.token', null)
  if (token) {
    loggerImplementation.logentries = {
      token: token
    }
  }
  let context = {
    awsRequestId: lambdaContext.awsRequestId
  }
  const logger = getLogger(appName, serviceName, context, {
    streams: [getConsoleStream()]
  })

  const queueUrl = config.get<string>('retsTimestampPersister.queueUrl')
  const queueClient = new Aws.Queues.SQSQueueClient(new AWS.SQS(), queueUrl)
  const queueService = new Queues.QueueService(queueClient, { maxNumberOfMessages: 10 })
  const consumer = new Queues.QueueConsumer(queueService)
  wirePrototypeMethodAsyncWrapped(RetsTimestampPersister.prototype as any, 'execute', logger)
  wirePrototypeMethodAsyncWrapped(ImportRepository.prototype, 'updateRetsQueryStatsBatch', logger)
  const options: IOptions = {
    queueBatchSize,
    mongoConnection: config.get<string>('retsTimestampPersister.mongoConnection'),
    mongoDatabase: config.get<string>('retsTimestampPersister.mongoDatabase'),
    remainingMillisThreshold
  }
  const mongoClient = new MongoClient()
  const importRepository = new ImportRepository(logger)
  const persister = new RetsTimestampPersister(
    new AWS.Lambda(), lambdaContext, consumer,
    mongoClient, importRepository, logger)
  wireMethodAsyncWrapped(persister, 'selfInvokeAsync', logger)
  return persister.execute(options).asCallback(callback)
}
