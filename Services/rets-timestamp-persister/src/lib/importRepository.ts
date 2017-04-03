import { Contracts } from 'etl'
import { ILogger } from 'infrastructure-logging-lib'
import { Db, ObjectID } from 'mongodb'
import * as BPromise from 'bluebird'
import { IImportRepository, IDbResponse } from './interfaces'
import { getDefault } from '../config'
import { MongoDB } from 'infrastructure-node-dbutils'
const DocumentRepository = MongoDB.DocumentRepository
type UpdateOperation<T> = MongoDB.UpdateOperation<T>

const importsCollectionName = getDefault('retsTimestampPersister.importsCollectionName', 'imports')

export class ImportRepository extends DocumentRepository implements IImportRepository {
  constructor(
    private logger: ILogger
  ) {
    super()
  }

  // methods
  updateRetsQueryStats(
    retsStatsAvailable: Contracts.RetsStatsAvailable,
    db: Db): BPromise<IDbResponse> {
    let getUpdate = this.getUpdateOperation
    let operation: UpdateOperation<Contracts.RetsStatsAvailable> = {
      collectionName: importsCollectionName,
      getFilter: (doc) => {
        return { _id: new ObjectID(retsStatsAvailable.context.importId) }
      },
      getUpdate
    }
    return BPromise.try(() => this.updateOne(retsStatsAvailable, operation, db))
      .then(dbResponse => {
        this.logger.audit('ImportRepository.updateRetsQueryStats', 'info', {
          dbResponse
        })
        if (dbResponse.modifiedCount !== 1) {
          this.logger.audit(
            'ImportRepository.updateRetsQueryStats.modifiedCount',
            'warn',
            {
              dbResponse,
              expected: 1,
              actual: dbResponse.modifiedCount
            }
          )
        }
        return dbResponse
      })
  }
  updateRetsQueryStatsBatch(
    retsStatsAvailableList: Contracts.RetsStatsAvailable[],
    db: Db): BPromise<IDbResponse> {
    let getUpdate = this.getUpdateOperation
    let operation: UpdateOperation<Contracts.RetsStatsAvailable> = {
      collectionName: importsCollectionName,
      getFilter: (doc) => {
        return { _id: new ObjectID(doc.context.importId) }
      },
      getUpdate
    }
    return BPromise.bind(this)
      .then(() => this.updateOneBatch(retsStatsAvailableList, operation, db))
      .then(dbResponse => {
        this.logger.audit('ImportRepository.updateRetsQueryStatsBatch', 'info', {
          dbResponse
        })
        if (dbResponse.modifiedCount !== retsStatsAvailableList.length) {
          this.logger.audit(
            'ImportRepository.updateRetsQueryStatsBatch.modifiedCount',
            'warn',
            {
              dbResponse,
              expected: retsStatsAvailableList.length,
              actual: dbResponse.modifiedCount
            }
          )
        }
        return dbResponse
      })
  }
  /**
   * $set: {
   *  "ETLServiceConfig.retsQueryStats.${resourceName}${className}" => {}
   * }
   */
  getUpdateOperation(doc: Contracts.RetsStatsAvailable): { $set: any } {
    let set: any = {}
    doc.retsQueryStats.forEach((stat) => {
      set[`ETLServiceConfig.retsQueryStats.${stat.resourceName}${stat.className}`] = stat
    })
    return {
      $set: set
    }
  }
}
