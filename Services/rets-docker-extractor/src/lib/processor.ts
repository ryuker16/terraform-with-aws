import { injectable, inject } from 'inversify'
import T from './types'
import { Queues } from 'infrastructure-node-cloudservices-lib'
import { RetsImporterService } from './rets/retsImporterService'
import { RetsExporterServiceFactory } from './rets/retsExporterService'
import { RetsTimestampNotifierService } from './rets/retsTimestampNotifierService'
import { IProcessorNotifier } from './processorNotifier'
import * as BPromise from 'bluebird'
import { Extraction, Models } from 'etl'
import { ILogger } from 'infrastructure-logging-lib'
import * as config from 'config'
import * as async from 'async'
import * as _ from 'lodash'
import { wireMethodAsync } from 'infrastructure-nodeaspect-lib'

@injectable()
export class ExtractProcessor {
  private sleepTimeMs: number
  private batchSize: number
  constructor(
    @inject(T.Config) private config: config.IConfig,
    @inject(T.QueueConsumer) private queue: Queues.IQueueConsumer<Extraction.RetsRequest, any>,
    @inject(T.RetsImporterService) private importer: RetsImporterService,
    @inject(T.FactoryRetsExporterService) private exporterFactory: typeof RetsExporterServiceFactory,
    @inject(T.ProcessorNotifier) private notifier: IProcessorNotifier,
    @inject(T.RetsTimestampNotifierService) private timestampNotifier: RetsTimestampNotifierService,
    @inject(T.ILogger) private logger: ILogger
  ) {
    if (!queue || !_.isFunction(queue.consume)) {
      throw new TypeError('QueueService')
    }
    if (!importer || !_.isFunction(importer.importListings)) {
      throw new TypeError('RetsImporterService')
    }
    this.sleepTimeMs = parseInt(config.get<string>('sleepTimeMs'), 10)
    this.batchSize = config.has('batchSize') ? parseInt(config.get<string>('batchSize'), 10) : 1
  }

  /**
   * main entry point for node index.js
   */
  main() {
    if (this.config.has('extractionRequest') &&
      _.isObjectLike(this.config.get<any>('extractionRequest'))) {
      const extractionRequest = this.config.get<Extraction.RetsRequest>('extractionRequest')
      return this.processExtractionRequest(extractionRequest)
    }
    return this.consumeQueueForever()
  }

  consumeQueue() {
    return this.queue.consume({
      handleMessage: this.processMessage.bind(this),
      batchSize: this.batchSize
    })
  }

  consumeQueueForever(): BPromise<any> {
    let self = this
    return BPromise.fromCallback((callback) => {
      async.forever(
        self.consumeQueueForeverIterator.bind(self),
        callback)
    }).catch(BPromise.OperationalError, (err) => {
      throw err.cause
    })
  }

  consumeQueueForeverIterator(next: ErrorCallback<any>) {
    let delayNext = (err?: any) => setTimeout(next, this.sleepTimeMs, err)
    let isFatalError = (err?: any) => {
      return err && err instanceof TypeError
    }
    BPromise.bind(this)
      .then(() => this.consumeQueue())
      .then(() => delayNext())
      .catch(isFatalError, err => {
        this.logger.error(err)
        // break forever iteration on fatal errors
        delayNext(err)
      })
      .catch((err) => {
        this.logger.error(err)
        // otherwise, continue next
        delayNext()
      })
  }

  processMessage(message: Queues.IQueueMessage<Extraction.Request>): BPromise<any> {
    if (!message || !message.Data) {
      return BPromise.resolve([])
    }
    let extractionRequest = message.Data as Extraction.RetsRequest
    return this.processExtractionRequest(extractionRequest)
  }

  processExtractionRequest(extractionRequest: Extraction.RetsRequest) {
    this.logger.setContext(extractionRequest.context)
    return BPromise.bind(this)
      .then(() => {
        return this.importer.importListings(
          extractionRequest.config as Models.RetsImportConfig,
          extractionRequest.context)
      })
      .tap((importListingsResponse) => {
        if (importListingsResponse) {
          return BPromise.try(() => {
            this.notifier.notifyImportedListings(importListingsResponse, extractionRequest)
          })
        }
      })
      .tap((importListingsResponse) => {
        return BPromise.try(() => {
          this.timestampNotifier.processImport(importListingsResponse, extractionRequest)
        })
      })
      .then((importListingsResponse) => {
        let exporter = this.exporterFactory(extractionRequest, this.logger)
        return exporter.exportListings(extractionRequest, importListingsResponse)
      })
  }
}
