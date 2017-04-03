import { UtcDateString, Legacy, Contracts, Extraction, Context } from 'etl'
import { ILogger } from 'infrastructure-logging-lib'
import MongoExtractor from './mongoDbRepository'
import { AWSPublisher, PublishMessageResult } from './awsPublisher'
import ImportMapper from './legacyImportMapper'
import * as Promise from 'bluebird'
import * as moment from 'moment'
import * as UUID from 'node-uuid'

export class ExtractDispatcher {
  constructor(
    private extractor: MongoExtractor,
    private publisher: AWSPublisher,
    private mapper: ImportMapper,
    private logger: ILogger
  ) {
  }
  static buildContext(
    event: Contracts.ExtractSchedulerTriggeredEvent,
    lambdaContext: AwsLambda.Context): Context {
    const correlationID = lambdaContext.awsRequestId || UUID.v4()
    let now = moment().utc()
    let interval = event.dispatcher.periodMinutes || 15
    let diffMinutes = now.minutes() % interval
    const period = now.add(-diffMinutes, 'minutes').format('YYYY-MM-DD-HH-mm')
    return {
      correlationID,
      scheduleId: event.dispatcher.scheduleId,
      period: period,
      startTime: now.format() as UtcDateString,
      protocol: event.dispatcher.protocol
    }
  }

  run(
    event: Contracts.ExtractSchedulerTriggeredEvent,
    context: Context) {

    let mapImport = this.processImport.bind(this, event, context) as
      (i: Legacy.Import) => Promise<PublishMessageResult>

    return Promise.bind(this)
      .then(() => this.extractor.getScheduledImports(event.dispatcher.scheduleId))
      .map(mapImport)
      .then((results) => {
        if (Array.isArray(results)) {
          return {
            successCount: results.filter((msg) => {
              return msg && !!msg.MessageId
            }).length,
            MessageIds: results.map((msg) => msg.MessageId)
          }
        }
        return results
      })
  }

  publishMessage(
    event: Contracts.ExtractSchedulerTriggeredEvent,
    extractionRequest: Extraction.Request) {
    return this.publisher.publishMessage(extractionRequest, event.dispatcher.queueUrl)
  }

  processImport(
    event: Contracts.ExtractSchedulerTriggeredEvent,
    context: Context,
    i: Legacy.Import) {
    return Promise.try(() => {
      let extractionRequest = this.mapper.buildExtractionRequest(i, context)
      this.logger.audit('ExtractDispatcher.buildExtractionRequest', 'info', { extractionRequest } )
      return this.publishMessage(event, extractionRequest)
    }).catch(err => {
      this.logger.error(err)
      this.logger.audit('ExtractDispatcher.buildExtractionRequest', 'warn', { err, import: i })
      return {
        MessageId: null
      }
    })
  }
}
