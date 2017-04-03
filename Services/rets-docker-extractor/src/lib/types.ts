const T = {
  QueueConsumer: Symbol('QueueConsumer'),
  QueueService: Symbol('QueueService'),
  IQueueClient: Symbol('IQueueClient'),
  ExtractProcessor: Symbol('ExtractProcessor'),
  ILogger: Symbol('ILogger'),
  FactoryRetsExporterService: Symbol('Factory<RetsExporterService>'),
  RetsClientService: Symbol('RetsClientService'),
  RetsStatic: Symbol('RetsStatic'),
  RetsImporterService: Symbol('RetsImporterService'),
  ProcessorNotifier: Symbol('ProcessorNotifier'),
  RetsExporterService: Symbol('RetsExporterService'),
  RetsTimestampNotifierService: Symbol('RetsTimestampNotifierService'),
  SNSFactory: Symbol('AWS.SNSFactory'),
  S3Factory: Symbol('AWS.SNSFactory'),
  FirehoseFactory: Symbol('AWS.FirehoseFactory'),
  Config: Symbol('Config')
}

export default T
