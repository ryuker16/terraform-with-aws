import { ResoType, MongoID, MongoTimestamp } from 'etl'
import { Db, ReplaceOneOptions, ObjectID } from 'mongodb'
import * as BPromise from 'bluebird'
import * as _ from 'lodash'
import { ILogger } from 'infrastructure-logging-lib'
import * as moment from 'moment'
import { MongoDB } from 'infrastructure-node-dbutils'
type UpdateOperation<T> = MongoDB.UpdateOperation<T>

function hasOid(id: any): id is { $oid: string } {
  return _.has(id, '$oid') && _.isString(id.$oid)
}

export interface IStoreResponse {
  collection?: string
  operation?: string
  modifiedCount?: number
  upsertedCount?: number
  storedDocuments?: IBaseDocument[]
}

export interface IBaseDocument {
  _id: MongoID
  created_at: MongoTimestamp
  updated_at: MongoTimestamp
}

export abstract class ResoDocumentPersister<T extends Partial<IBaseDocument>> extends MongoDB.DocumentRepository {
  abstract resoType: ResoType
  constructor(public logger: ILogger) {
    super()
  }

  static objectIDToString(id: MongoID) {
    return id instanceof ObjectID
      ? id.toHexString()
      : _.isString(id)
        ? _.toString(id)
        : hasOid(id)
          ? _.toString(id.$oid)
          : ''
  }

  static parseObjectID(id: any): ObjectID {
    return id instanceof ObjectID
      ? id
      : _.isString(id)
        ? new ObjectID(id)
        : hasOid(id)
          ? new ObjectID(id.$oid)
          : null
  }

  abstract getFilter(doc: T): Object
  abstract getUpdate(doc: T): Object
  abstract generateIdHexString(doc: T): string
  abstract getCollectionName(): string
  abstract isValidDocument(doc: T): boolean

  upsertOneResoDoc(doc: T, db: Db, collectionName?: string): BPromise<IStoreResponse> {
    doc.updated_at = `${moment.utc().format('YYYY-MM-DD HH:mm:ss')}.000Z`
    let opts: ReplaceOneOptions = {
      upsert: true
    }

    collectionName = collectionName || this.getCollectionName()

    let updateOperation = {
      collectionName,
      getFilter: (doc: T) => this.getFilter(doc),
      getUpdate: (doc: T) => this.getUpdate(doc)
    }

    if (this.isValidDocument(doc)) {
      return BPromise.bind(this)
        .then(() => {
          return this.updateOne(doc, updateOperation, db, opts)
        })
        .tap((dbResponse) => {
          this.logger.audit('ResoDocumentPersister.upsertOneResoDoc', 'info', { doc, dbResponse })
        })
        .then(result => {
          return {
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
            operation: 'replaceOne',
            collectionName,
            storedDocuments: [doc]
          } as IStoreResponse
        })
    } else {
      this.logger.audit('ResoDocumentPersister.invalidDocument', 'warn', { doc: doc })
      return BPromise.resolve({
        modifiedCount: 0,
        upsertedCount: 0
      })
    }
  }
  upsertBatchResoDocs(documents: T[], db: Db, collectionName?: string): BPromise<IStoreResponse> {
    if (!documents || !documents.length) {
      return BPromise.resolve({
        modifiedCount: 0,
        upsertedCount: 0
      })
    }

    collectionName = collectionName || this.getCollectionName()

    // filter out invalid docs and log this
    let validDocuments = _.filter(documents, doc => {
      let isValid = this.isValidDocument(doc)
      if (!isValid) {
        this.logger.audit('ResoDocumentPersister.invalidDocument', 'warn', { doc: doc })
      }
      return isValid
    })

    _.forEach(validDocuments, doc => {
      doc.updated_at = `${moment.utc().format('YYYY-MM-DD HH:mm:ss')}.000Z`
    })

    let updateOperation = {
      collectionName,
      getFilter: this.getFilter.bind(this),
      getUpdate: this.getUpdate.bind(this)
    }
    return BPromise.bind(this)
      .then(() => {
        return super.upsertOneBatch(validDocuments, updateOperation, db)
      })
      .tap((dbResponse) => {
        this.logger.audit('ResoDocumentPersister.upsertBatchResoDocs', 'info', { dbResponse })
      })
  }
}
