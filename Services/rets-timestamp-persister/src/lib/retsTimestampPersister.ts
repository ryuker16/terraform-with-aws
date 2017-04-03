import { Lambda } from 'aws-sdk'
import { Contracts } from 'etl'
import { Queues, Aws } from 'infrastructure-node-cloudservices-lib'
import { MongoClient, Db } from 'mongodb'
import { TMessage, TMessageData } from './interfaces'
import { ILogger } from 'infrastructure-logging-lib'
import * as Promise from 'bluebird'
import * as _ from 'lodash'
import { ImportRepository } from './importRepository'

export interface IOptions {
  queueBatchSize: number
  mongoConnection: string
  mongoDatabase: string
  remainingMillisThreshold: number
}
export class RetsTimestampPersister extends Aws.Lambda.LambdaHandler<Contracts.RetsStatsAvailable> {
  messagesReceived = false
  queueEmpty = false
  database: Db = null
  constructor(
    lambda: Lambda,
    public lambdaContext: AwsLambda.Context,
    private consumer: Queues.IQueueConsumer<TMessageData, any>,
    private mongoClient: MongoClient,
    private importRepository: ImportRepository,
    private logger: ILogger
  ) {
    super(lambda, lambdaContext)
  }
  static validateOptions(options: IOptions) {
    if (!options) {
      throw new TypeError('options')
    }
  }
  execute(options: IOptions) {
    const self = this

    self.messagesReceived = self.queueEmpty = false

    try {
      RetsTimestampPersister.validateOptions(options)
    } catch (err) {
      return Promise.reject(err)
    }

    self.consumer.once('empty', () => {
      this.queueEmpty = true
    })

    self.consumer.once(Queues.QueueConsumer.Events.messages_received, () => {
      this.messagesReceived = true
    })

    let thenSelfInvokeCheckAsync = this.selfInvokeAfterConsumeResolves.bind(this)
    let catchSelfInvokeCheckAsync = this.selfInvokeAfterConsumeRejects.bind(this)
    let closeDbAsync = this.closeDbAsync.bind(this)
    let consumeUntil = this.consumeUntil.bind(this, options)
    let handleMessageBatch = this.handleMessageBatch.bind(this, options)

    let consumeQueueOptions: Queues.IConsumeQueueOptions<TMessageData, any> = {
      batchSize: options.queueBatchSize,
      enableBatchProcessing: true,
      handleMessageBatch: handleMessageBatch,
      consumeUntil: consumeUntil
    }

    return self.consumer.consume(consumeQueueOptions)
      .then(closeDbAsync)
      .catch((err) => {
        return Promise.resolve(closeDbAsync())
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
      this.logger.telemetry('RetsTimestampPersister.consumeUntil', 'getRemainingTimeInMillis', 'ms', remaining)
      return true
    }
    return false
  }
  selfInvokeAfterConsumeResolves() {
    if (this.messagesReceived && !this.queueEmpty) {
      return this.selfInvokeAsync()
    }
  }
  selfInvokeAfterConsumeRejects(err?: any) {
    if (err) {
      this.logger.error(err)
    }
    if (this.messagesReceived && !this.queueEmpty) {
      this.logger.audit('RetsTimestampPersister.selfInvokeAfterConsumeRejects', 'warn', { err })
      return this.selfInvokeAsync()
    }
    throw err
  }

  closeDbAsync() {
    if (this.database) {
      return Promise.resolve(this.database.close())
    }
  }

  ensureDbAsync(options: IOptions) {
    if (this.database) {
      return Promise.resolve(this.database)
    }
    return Promise.bind(this)
      .then(() => this.mongoClient.connect(options.mongoConnection))
      .tap((db) => {
        this.database = db ? db.db(options.mongoDatabase) : null
        if (this.database) {
          this.database.on('reconnect', (reconnect: any) => {
            this.logger.audit('RetsTimestampPersister.Db.reconnect', 'info', { reconnect })
          })
          this.database.on('error', (err: any) => {
            this.logger.audit('RetsTimestampPersister.Db.error', 'warn', { err })
            this.logger.error(err, { msg: 'RetsTimestampPersister.Db.error' })
          })
        }
      })
      .then(() => this.database)
  }

  handleMessageBatch(options: IOptions, messages: TMessage[]) {
    this.messagesReceived = true
    return Promise.bind(this)
      .then(() => this.ensureDbAsync(options))
      .then((db) => this.persistMessageBatch(messages, db, options))
      .tap(response => {
        this.logger.audit('RetsTimestampPersister.handleMessageBatch', 'info', {
          response
        })
      })
  }

  persistMessageBatch(messages: TMessage[], db: Db, options: IOptions): Promise<any> {
    let retsStatsAvailableList = _.map(messages, (message) => {
      message.Data.Data = JSON.parse(message.Data.Message)
      return message.Data.Data
    })
    _.each(retsStatsAvailableList, (retsStatsAvailable) => {
      this.logger.mergeContext(retsStatsAvailable.context)
    })
    return this.importRepository.updateRetsQueryStatsBatch(retsStatsAvailableList, db)
  }
}
