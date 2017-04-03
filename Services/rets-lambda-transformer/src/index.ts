import { wirePrototypeMethodAsync } from 'infrastructure-nodeaspect-lib'
import { getLogger, ILoggerImplementationOptions, getConsoleStream } from 'infrastructure-logging-lib'
import { DocumentRepo } from './lib/documentRepo'
import { FirehoseTransformer } from './lib/firehoseTransformer'
import * as AWS from 'aws-sdk'
import * as BPromise from 'bluebird'
import { Contracts, Callback, CallbackOf } from 'etl'
import { EventPublisher } from './lib/eventPublisher'
import { Aws } from 'infrastructure-node-cloudservices-lib'
import { RetsLambdaTransformer } from './lib/retsLambdaTransformer'
import { RetsFirehoseTransformer } from './lib/retsFirehoseTransformer'
import * as config from 'config'

AWS.config.setPromisesDependency(BPromise)

export const REGION = config.has('region')
  ? config.get<string>('region') || 'us-east-1'
  : 'us-east-1'

AWS.config.update({ region: REGION })
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  sns: '2010-03-31',
  lambda: '2015-03-31',
  s3: '2006-03-01'
}
export function handler(
  event: Contracts.RetsDocumentExtractedEvent,
  context: AwsLambda.Context,
  callback: Callback) {
  const appName = `etl-${process.env.NODE_ENV || 'development'}`
  const serviceName = context.functionName || 'rets-lambda-transformer'
  let logContext = {
    awsRequestId: context.awsRequestId
  }
  const logger = getLogger(appName, serviceName, logContext, {
    streams: [getConsoleStream()]
  })

  if (config.util.getEnv('NODE_ENV') !== 'test') {
    wirePrototypeMethodAsync(RetsLambdaTransformer.prototype as any, 'run', logger)
  }
  let queueUrl = config.get<string>('transformer.queueUrl')
  let s3Client = new AWS.S3()
  let snsClient = new AWS.SNS()
  let sqsClient = new Aws.Queues.SQSQueueClient(new AWS.SQS(), queueUrl)
  let lambdaClient = new AWS.Lambda()
  let repo = new DocumentRepo(s3Client, logger)
  let publisher = new EventPublisher(snsClient)
  let transformer = new RetsLambdaTransformer(sqsClient, repo, publisher, lambdaClient, logger, context)
  transformer.run().asCallback(callback)
}

export function firehosehandler(
  event: AwsContracts.FirehoseRecords,
  context: AwsLambda.Context,
  callback: CallbackOf<AwsContracts.FirehoseProcessedRecords>) {
  const appName = `etl-${process.env.NODE_ENV || 'development'}`
  const serviceName = context.functionName || 'rets-lambda-transformer'
  let loggerImplementation: Partial<ILoggerImplementationOptions> = {}
  let token = config.has('logentries.token') ? config.get<string>('logentries.token') : ''
  if (token) {
    loggerImplementation.logentries = { token }
  }
  let logContext = {
    awsRequestId: context.awsRequestId
  }
  const logger = getLogger(appName, serviceName, logContext, loggerImplementation)

  if (config.util.getEnv('NODE_ENV') !== 'test') {
    wirePrototypeMethodAsync(RetsFirehoseTransformer.prototype, 'run', logger)
    wirePrototypeMethodAsync(RetsFirehoseTransformer.prototype, 'transformationHandler', logger)
  }

  const transformer = new RetsFirehoseTransformer(logger)
  transformer.run(event).asCallback(callback)
}
