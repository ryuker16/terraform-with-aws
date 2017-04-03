import { inject, injectable, interfaces } from 'inversify'
import T from '../types'
import { ImportListingsResponse, ResourceClassResponse, ResourceClassImagesResponse } from './interfaces'
import { Models, Extraction, Contracts, Context, ILogger } from 'etl'
import * as Rets from 'rets-client'
import * as moment from 'moment'
import * as AWS from 'aws-sdk'
import * as Promise from 'bluebird'
import * as config from 'config'
import * as _ from 'lodash'
import * as Rx from 'rx'

@injectable()
export class RetsTimestampNotifierService {
  sns: AWS.SNS
  constructor(
    @inject(T.SNSFactory) snsFactory: interfaces.Factory<AWS.SNS>,
    @inject(T.ILogger) private logger: ILogger
  ) {
    this.sns = snsFactory() as AWS.SNS
  }

  createRetsStatsAvailable(
    importConfig: Models.RetsImportConfig,
    importListingResponse: ImportListingsResponse,
    context: Context) {
    let retsQueryStats: Models.RetsQueryStats[] = this.createRetsQueryStats(
      importListingResponse,
      context)

    let retsStatsAvailable: Contracts.RetsStatsAvailable = {
      protocol: 'RETS',
      context: context,
      retsQueryStats,
      config: importConfig
    }
    return retsStatsAvailable
  }

  /**
   * NOTE - moving responsibility of filtering out err ResourceClassResponse to the rets-timestamp-persister
   */
  createRetsQueryStats(
    importListingResponse: ImportListingsResponse,
    context: Context): Models.RetsQueryStats[] {
    let retsStats: Models.RetsQueryStats[] = []
    _.forEach(importListingResponse.resources, resourceResponse => {
      _.forEach(resourceResponse.classes, (classResponse: ResourceClassResponse) => {
        let lastModField = classResponse.classModel.retsQueryFields.lastModField
        let photoLastModField = classResponse.classModel.retsQueryFields.lastPhotoModField
        let lastMod = this.getMaxTimestamp(lastModField, classResponse.results)
        let lastModTimeISO = this.getISOTimestamp(lastMod)
        let photoLastMod = this.getMaxTimestamp(photoLastModField, classResponse.results)
        let photoLastModTimeISO = this.getISOTimestamp(photoLastMod)
        let retsQueryStatsEntry: Partial<Models.RetsQueryStats> = {
          importId: context.importId,
          correlationID: context.correlationID,
          resourceName: classResponse.resourceName,
          className: classResponse.className,
          lastModTime: lastMod,
          photoLastModTime: photoLastMod,
          lastModTimeISO,
          photoLastModTimeISO
        }
        retsQueryStatsEntry.previousRunTime = _.isNil(classResponse.retsQueryStat)
          ? ''
          : classResponse.retsQueryStat.lastRunTime
        // next lastRunTime becomes the current import startTime
        retsQueryStatsEntry.lastRunTime = context.startTime
        // track resultCount between previousRunTime and this startTime
        retsQueryStatsEntry.resultCount = classResponse.results.length
        // push RetsQueryStats entry for updates only if the import did not err or net results
        if (!classResponse.err && retsQueryStatsEntry.resultCount > 0) {
          retsStats.push(retsQueryStatsEntry as Models.RetsQueryStats)
        }
      })
    })
    return retsStats
  }

  getMaxTimestamp(fieldName: string, results: Rets.IResource[]): string {
    let maxTimestamp = ''
    _.forEach(results, (listing: any) => {
      let fieldValue = _.get(listing, fieldName, '')
      if (moment(fieldValue).isValid()) {
        if (fieldValue > maxTimestamp) {
          maxTimestamp = fieldValue
        }
      } else {
        this.logger.audit(
          'RetsTimestampNotifierService.getMaxTimestamp invalid timestamp',
          'warn', {
            fieldName, fieldValue: fieldValue
          })
      }
    })
    return maxTimestamp
  }

  getISOTimestamp(dateString: string): string {
    let time = moment.parseZone(dateString)
    return time.isValid() ? time.toISOString() : ''
  }

  processImport(importResponse: ImportListingsResponse, extractionRequest: Extraction.RetsRequest) {
    return Promise.try(() => {
      let retsStatsAvailable = this.createRetsStatsAvailable(
        extractionRequest.config,
        importResponse,
        extractionRequest.context)
      return this.publishRetsStatsAvailable(retsStatsAvailable)
    })
  }

  publishRetsStatsAvailable(retsStatsAvailable: Contracts.RetsStatsAvailable) {
    let snsMsg = {
      Message: JSON.stringify(retsStatsAvailable),
      TopicArn: config.get<string>('RetsTimestampNotifierService.topicArn')
    }
    this.logger.audit('RetsTimestampNotifierService.publishRetsStatsAvailable', 'info', _.assign(
      {},
      retsStatsAvailable.context,
      {
        retsQueryStats: retsStatsAvailable.retsQueryStats,
        retsQueryStatsCount: _.isArray(retsStatsAvailable.retsQueryStats) ? retsStatsAvailable.retsQueryStats.length : 0
      }
    ))
    return Promise.resolve(this.sns.publish(snsMsg).promise())
  }
}
