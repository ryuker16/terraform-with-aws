import { injectable, inject } from 'inversify'
import { ILogger } from 'infrastructure-logging-lib'
import T from './types'
import { ImportListingsResponse } from './rets/interfaces'
import * as _ from 'lodash'
import { Extraction } from 'etl'

export interface IProcessorNotifier {
  notifyImportedListings(responses: ImportListingsResponse, request: Extraction.Request): void
}

@injectable()
export class ProcessorNotifier implements IProcessorNotifier {
  constructor(
    @inject(T.ILogger) private logger: ILogger
  ) {
  }
  notifyImportedListings(response: ImportListingsResponse, request: Extraction.Request) {
    let sum = 0
    _.map(response.resources, (resource) => {
      _.map(resource.classes, (classResponse) => {
        let count = (classResponse.results || []).length
        sum += count
        this.logger.telemetry(
          'notifyImportedListings',
          `total_${resource.resoType}`,
          'count',
          count,
          _.omit(classResponse, 'results', 'responses'))
      })
    })
    this.logger.telemetry(
      'notifyImportedListings',
      `total_all_resources`,
      'count',
      sum,
      request.context
    )
  }
}
