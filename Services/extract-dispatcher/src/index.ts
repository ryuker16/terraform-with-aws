import MongoExtractor from './mongoDbRepository'
import { AWSPublisher } from './awsPublisher'
import ImportMapper from './legacyImportMapper'
import { Contracts, Callback } from 'etl'
import { MongoClient } from 'mongodb'
import * as Promise from 'bluebird'
import * as AWS from 'aws-sdk'
import { getLogger, ILogger, getConsoleStream } from 'infrastructure-logging-lib'
import { ExtractDispatcher } from './extractDispatcher'
import { wirePrototypeMethodAsync } from 'infrastructure-nodeaspect-lib'
import { getDefault } from './config'
import * as config from 'config'

AWS.config.setPromisesDependency(Promise)
AWS.config.update({ region: config.get<string>('region') })

export function wireMethods(logger: ILogger) {
  if (config.util.getEnv('NODE_ENV') !== 'test') {
    wirePrototypeMethodAsync(ExtractDispatcher.prototype, 'run', logger)
    wirePrototypeMethodAsync(ExtractDispatcher.prototype, 'publishMessage', logger)
    wirePrototypeMethodAsync(MongoExtractor.prototype, 'getScheduledImports', logger)
  }
}

export function handler(
  event: Contracts.ExtractSchedulerTriggeredEvent,
  lambdaContext: AwsLambda.Context,
  callback: Callback) {
  let context = ExtractDispatcher.buildContext(event, lambdaContext)
  const appName = `etl-${process.env.NODE_ENV || 'development'}`
  const serviceName = lambdaContext.functionName || 'extract-dispatcher'
  let logger: ILogger = null
  if (event.debug || getDefault('debug', false)) {
    logger = getLogger(appName, serviceName, context, {
      streams: [getConsoleStream({ level: 'debug' })]
    })
    AWS.config.update({
      logger: console
    })
  } else {
    logger = getLogger(appName, serviceName, context, {
      // default to info
      streams: [getConsoleStream()]
    })
  }
  wireMethods(logger)
  const mongoClient = new MongoClient()
  const extractor = new MongoExtractor(mongoClient, logger)
  const publisher = new AWSPublisher(new AWS.SQS(), logger)
  const mapper = new ImportMapper()
  const dispather = new ExtractDispatcher(extractor, publisher, mapper, logger)
  Promise.resolve(dispather.run(event, context))
    .asCallback(callback)
}
