import 'reflect-metadata'
import { Container, interfaces, decorate, injectable } from 'inversify'
import T from './lib/types'
import * as E from './entities'
import * as config from 'config'
import * as AWS from 'aws-sdk'
import * as rets from 'rets-client'
import { getLogger, ILogger, ILoggerImplementationOptions } from 'infrastructure-logging-lib'
import { Queues, Aws } from 'infrastructure-node-cloudservices-lib'
import { EventEmitter } from 'events'

// http://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
if (config.has('accessKeyId') &&
  config.get('accessKeyId') &&
  config.has('secretAccessKey') &&
  config.get('secretAccessKey')) {
  AWS.config.update({
    credentials: {
      accessKeyId: config.get<string>('accessKeyId'),
      secretAccessKey: config.get<string>('secretAccessKey')
    }
  })
}
if (config.has('region') && config.get('region')) {
  AWS.config.update({
    region: config.get<string>('region')
  })
}

AWS.config.apiVersions = {
  firehose: '2015-08-04',
  s3: '2006-03-01',
  sns: '2010-03-31'
  // other service API versions
}

const appName = `etl-${process.env.NODE_ENV || 'development'}`
const serviceName = 'rets-docker-extractor'

let loggerImplementationOptions: Partial<ILoggerImplementationOptions> = {}
if (config.has('logentries.token') && config.get('logentries.token')) {
  loggerImplementationOptions.logentries = {
    token: config.get<string>('logentries.token')
  }
}
const logger = getLogger(appName, serviceName, {}, loggerImplementationOptions)

const container = new Container()

import { wirePrototypeMethodAsync } from 'infrastructure-nodeaspect-lib'

if (config.util.getEnv('NODE_ENV') !== 'test') {
  wirePrototypeMethodAsync(E.ExtractProcessor.prototype, 'consumeQueueForever', logger)
  wirePrototypeMethodAsync(E.ExtractProcessor.prototype, 'consumeQueue', logger)
  wirePrototypeMethodAsync(E.ExtractProcessor.prototype, 'processExtractionRequest', logger)
  wirePrototypeMethodAsync(E.RetsImporterService.prototype, 'importListings', logger)
  wirePrototypeMethodAsync(E.RetsImporterService.prototype, 'importResourceClass', logger)
  wirePrototypeMethodAsync(E.RetsImporterService.prototype, 'importResourceClassImages', logger)
  wirePrototypeMethodAsync(E.RetsClientService.prototype, 'loadListings', logger)
  wirePrototypeMethodAsync(E.RetsTimestampNotifierService.prototype, 'processImport', logger)
  wirePrototypeMethodAsync(E.RetsExporterService.prototype, 'exportListings', logger)
  wirePrototypeMethodAsync(E.RetsExporterService.prototype, 'putExtractionRequestBatchToFirehose', logger)
}

decorate(injectable(), Queues.QueueService)
decorate(injectable(), Queues.QueueConsumer)
decorate(injectable(), EventEmitter)

const importQueueUrl = config.get<string>('importQueueUrl')
const queueClient = new Aws.Queues.SQSQueueClient(new AWS.SQS(), importQueueUrl)
const queueService = new Queues.QueueService(queueClient)
const queueConsumer = new Queues.QueueConsumer<any, any>(queueService)

container.bind<Queues.QueueService>(T.QueueService).toConstantValue(queueService)
container.bind<Queues.QueueConsumer<any, any>>(T.QueueConsumer).toConstantValue(queueConsumer)
container.bind<Queues.IQueueClient>(T.IQueueClient).toConstantValue(queueClient)

container.bind<AWS.SNS>(T.SNSFactory).toFactory((context: interfaces.Context) => {
  return () => new AWS.SNS()
})
container.bind<AWS.S3>(T.S3Factory).toFactory((context: interfaces.Context) => {
  return () => new AWS.S3()
})
container.bind<AWS.Firehose>(T.FirehoseFactory).toFactory((context: interfaces.Context) => {
  return () => new AWS.Firehose()
})

container.bind<interfaces.Factory<E.RetsExporterService>>(T.FactoryRetsExporterService)
  .toFactory((context: interfaces.Context) => {
    return (request: any, logger: ILogger) => E.RetsExporterServiceFactory(request, logger)
  })
container.bind<E.RetsTimestampNotifierService>(T.RetsTimestampNotifierService).to(E.RetsTimestampNotifierService)
container.bind<E.RetsImporterService>(T.RetsImporterService).to(E.RetsImporterService)
container.bind<rets.RetsStatic>(T.RetsStatic).toConstantValue(rets)
container.bind<E.RetsClientService>(T.RetsClientService).to(E.RetsClientService)
container.bind<string>('queueUrl').toConstantValue(importQueueUrl)
container.bind<ILogger>(T.ILogger).toConstantValue(logger)
container.bind<E.ExtractProcessor>(T.ExtractProcessor).to(E.ExtractProcessor)
container.bind<E.ProcessorNotifier>(T.ProcessorNotifier).to(E.ProcessorNotifier)

container.bind<config.IConfig>(T.Config).toConstantValue(config)

export = container
