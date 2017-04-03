/// <reference path="../definitions/index.d.ts" />
import { Contracts } from 'etl'
import * as AWS from 'aws-sdk'
import * as config from 'config'
import { getDefault, getDefaultInt } from './config'
import { Aws, Queues } from 'infrastructure-node-cloudservices-lib'
import { DocumentStorage } from './lib/documentStorage'
import { MongoClient } from 'mongodb'
import { PropertyDocumentPersister } from './lib/propertyDocumentPersister'
import { DeliveryStreamS3RecordsExtractor } from './lib/deliveryStreamS3RecordsExtractor'
import { QueueRecordsExtractor } from './lib/queueRecordsExtractor'
import { IOptions, MongoPersister, UpsertMode } from './lib/mongoPersister'
import { getLogger, ILoggerImplementationOptions, ILogger, getConsoleStream } from 'infrastructure-logging-lib'
import { wirePrototypeMethodAsync, wireMethodAsync } from 'infrastructure-nodeaspect-lib'
import * as BPromise from 'bluebird'

function wireAsync(cls: any, method: string, logger: ILogger) {
  if (process.env.NODE_ENV !== 'test') {
    wirePrototypeMethodAsync(cls, method, logger)
  }
}
const region = getDefault('region', 'us-east-1')
const upsertMode = getDefault('persister.upsertMode', 'batch' as UpsertMode)
const remainingMillisThreshold = getDefaultInt('persister.remainingMillisThreshold', 5000)

AWS.config.setPromisesDependency(BPromise)
AWS.config.update({ region })
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  sns: '2010-03-31',
  lambda: '2015-03-31',
  s3: '2006-03-01'
}

export function handler(
  event: Contracts.RetsDocumentTransformedEvent,
  lambdaContext: AwsLambda.Context,
  callback: Function) {
  console.log('logger.stream.name is', config.get('logger.stream.name'))
  const appName = `etl-${process.env.NODE_ENV || 'development'}`
  const serviceName = lambdaContext.functionName || 'mongo-persister'
  let context: any = {
    awsRequestId: lambdaContext
  }
  const maxNumberOfMessages = parseInt(config.get<string>('persister.maxNumberOfMessages'), 10)
  const logger = getLogger(appName, serviceName, context, {
    streams: [getConsoleStream()]
  })
  const queueUrl = config.get<string>('persister.queueUrl')
  const queueClient = new Aws.Queues.SQSQueueClient(new AWS.SQS(), queueUrl)
  const queueService = new Queues.QueueService(queueClient, { maxNumberOfMessages })
  const consumer = new Queues.QueueConsumer(queueService)
  const docStorage = new DocumentStorage(new AWS.S3())
  const documentPersister = new PropertyDocumentPersister(logger)
  const options: IOptions = {
    upsertMode: upsertMode,
    queueBatchSize: 1,
    mongoConnection: config.get<string>('persister.mongoConnection'),
    remainingMillisThreshold
  }
  const mongoClient = new MongoClient()
  const recordsExtractor = new DeliveryStreamS3RecordsExtractor(logger, new AWS.S3())
  const queueMessageParser = new QueueRecordsExtractor(recordsExtractor)
  const persister = new MongoPersister(
    new AWS.Lambda(),
    lambdaContext,
    consumer,
    docStorage,
    documentPersister,
    mongoClient,
    queueMessageParser,
    logger)
  wireAsync(persister, 'execute', logger)
  wireAsync(persister, 'handleMessageBatch', logger)
  wireAsync(persister, 'selfInvokeAsync', logger)
  return BPromise.resolve(persister.execute(options)).asCallback(callback)
}
