import { Lambda } from 'aws-sdk'
import { Contracts, CallbackOf, HashMapOf, Legacy } from 'etl'
import { IDocumentStorage } from './documentStorage'
import { Queues, Aws } from 'infrastructure-node-cloudservices-lib'
import { IStoreResponse, ResoDocumentPersister } from './resoDocumentPersister'
import { MongoClient, Db, MongoError } from 'mongodb'
import { TMessage, TMessageData, IDeliveryStreamS3RecordsExtractor } from './interfaces'
import { ILogger } from 'infrastructure-logging-lib'
import { QueueRecordsExtractor } from './queueRecordsExtractor'
import * as BPromise from 'bluebird'
import * as _ from 'lodash'
import * as config from 'config'
import * as Rx from 'rx'
type Property = Legacy.Listings.Listing
export type UpsertMode = 'single' | 'batch'
export interface IOptions {
  queueBatchSize: number
  upsertMode: UpsertMode
  mongoConnection: string
  remainingMillisThreshold: number
}

export class MongoPersister extends Aws.Lambda.LambdaHandler<Contracts.RetsDocumentTransformedEvent> {
  static MongoBatchSize: number = parseInt(config.get<string>('persister.mongoBatchSize'), 10)
  // instance properties
  messagesReceived = false
  queueEmpty = false
  database: Db = null

  // constructor
  constructor(
    lambda: Lambda,
    public lambdaContext: AwsLambda.Context,
    private consumer: Queues.IQueueConsumer<TMessageData, any>,
    private documentStorage: IDocumentStorage,
    private documentPersister: ResoDocumentPersister<any>,
    private mongoClient: MongoClient,
    private queueRecordsExtractor: QueueRecordsExtractor,
    private logger: ILogger
  ) {
    super(lambda, lambdaContext)
  }

  // static methods
  static validateOptions(options: IOptions) {
    if (!options) {
      throw new TypeError('options')
    }
    if (!options.upsertMode) {
      throw new TypeError('upsertMode')
    }
  }

  // public methods
  execute(options: IOptions) {

    this.messagesReceived = this.queueEmpty = false

    try {
      MongoPersister.validateOptions(options)
    } catch (err) {
      return BPromise.reject(err)
    }

    this.consumer.once('empty', () => {
      this.queueEmpty = true
    })
    this.consumer.once(Queues.QueueConsumer.Events.messages_received, () => {
      this.messagesReceived = true
    })

    let thenSelfInvokeCheckAsync = this.selfInvokeAfterConsumeResolves.bind(this)
    let catchSelfInvokeCheckAsync = this.selfInvokeAfterConsumeRejects.bind(this)
    let closeDbAsync = this.closeDbAsync.bind(this)
    let consumeUntil = this.consumeUntil.bind(this, options)
    let handleMessageBatch = this.handleMessageBatch.bind(this, options)

    let consumeQueueOptions: Queues.IConsumeQueueOptions<TMessageData, any[]> = {
      batchSize: options.queueBatchSize,
      enableBatchProcessing: true,
      handleMessageBatch: handleMessageBatch,
      consumeUntil: consumeUntil
    }

    return BPromise.bind(this)
      .then(() => this.consumer.consume(consumeQueueOptions))
      .then(closeDbAsync)
      .catch((err) => {
        return BPromise.resolve(closeDbAsync())
          .finally(function () {
            throw err
          })
      })
      .then(thenSelfInvokeCheckAsync)
      .catch(catchSelfInvokeCheckAsync)
  }

  consumeUntil(options: IOptions) {
    const remaining = this.lambdaContext.getRemainingTimeInMillis()
    if (remaining <= options.remainingMillisThreshold) {
      this.logger.telemetry('MongoPersister.consumeUntil', 'getRemainingTimeInMillis', 'ms', remaining)
      return true
    }
    return false
  }

  selfInvokeAfterConsumeResolves() {
    if (this.messagesReceived && !this.queueEmpty) {
      this.logger.audit('MongoPersister.selfInvokeAfterConsumeResolves', 'info')
      return this.selfInvokeAsync()
    }
  }

  selfInvokeAfterConsumeRejects(err?: any) {
    if (err) {
      this.logger.error(err)
    }
    if (err instanceof MongoError) {
      throw err
    }
    if (this.messagesReceived && !this.queueEmpty) {
      this.logger.audit('MongoPersister.selfInvokeAfterConsumeRejects', 'warn', { err })
      return this.selfInvokeAsync()
    }
    throw err
  }

  closeDbAsync() {
    if (this.database) {
      return BPromise.resolve(this.database.close())
    }
  }

  ensureDbAsync(options: IOptions) {
    if (this.database) {
      return BPromise.resolve(this.database)
    }
    return BPromise.bind(this)
      .then(() => this.mongoClient.connect(options.mongoConnection))
      .then(db => db.db(config.get<string>('persister.mongoDatabase')))
      .tap((db) => {
        this.database = db
        if (this.database) {
          this.database.on('reconnect', (reconnect: any) => {
            this.logger.audit('MongoPersister.Db.reconnect', 'info', { reconnect })
          })
          this.database.on('error', (err: any) => {
            this.logger.audit('MongoPersister.Db.error', 'warn', { err })
            this.logger.error(err, { msg: 'MongoPersister.Db.error' })
          })
        }
      })
  }

  handleMessageBatch(options: IOptions, messages: TMessage[]) {
    this.messagesReceived = true
    return BPromise.bind(this)
      .then(() => this.ensureDbAsync(options))
      .then((db) => this.persistMessageBatch(messages, db, options))
      .tap(storeResponses => {
        _.each(storeResponses, (storeResponse) => this.logger.audit('handleMessageBatch', 'info', { storeResponse }))
      })
  }

  async persistMessageBatch(messages: TMessage[], db: Db, options: IOptions): Promise<IStoreResponse[]> {
    let source = Rx.Observable
      .from(messages)
      // emit the values from each sequence in order
      .concatMap((msg: TMessage) => this.queueRecordsExtractor.sourceRetsDocumentTransformed(msg))
    switch (options.upsertMode) {
      case 'single':
        return await source
          .concatMap((record: Contracts.RetsDocumentTransformed) => Rx.Observable.defer(async () => {
            return await this.persistRetsDocumentTransformed(record, db)
          }))
          .toArray()
          .toPromise()
      case 'batch':
        return await source
          .bufferWithCount(MongoPersister.MongoBatchSize)
          .concatMap((records: Contracts.RetsDocumentTransformed[]) => Rx.Observable.defer(async () => {
            return await this.persistRetsDocumentTransformedBatch(records, db)
          }))
          .flatMap((responses) => Rx.Observable.from(responses))
          .toArray()
          .toPromise()
    }
  }

  async persistRetsDocumentTransformedBatch(records: Contracts.RetsDocumentTransformed[], db: Db): Promise<IStoreResponse[]> {
    const source = Rx.Observable.from(records)
    const execution = source.groupBy((record) => record.config.destinationCollection)
      // process grouped records in order
      .concatMap(
      // select group records by array
      (group) => group.map((record, index) => {
        if (index === 0) {
          this.logger.setContext(record.context)
        }
        return record.transformedDocumentBody
      }).toArray(),
      // result selector
      (group, records: Property[]) => {
        return {
          collectionName: group.key,
          records
        }
      })
      // upsert each set of records
      .concatMap(async (item) => {
        this.logger.audit('MongoPersister.persistRetsDocumentTransformedBatch', 'info', {
          collectionName: item.collectionName,
          recordCount: item.records.length
        })
        return await this.documentPersister.upsertBatchResoDocs(item.records, db, item.collectionName)
      })
    return await execution
      .toArray()
      .toPromise()
  }

  persistRetsDocumentTransformed(record: Contracts.RetsDocumentTransformed, db: Db): BPromise<IStoreResponse> {
    return this.documentPersister.upsertOneResoDoc(record.transformedDocumentBody, db, record.config.destinationCollection)
  }
}
