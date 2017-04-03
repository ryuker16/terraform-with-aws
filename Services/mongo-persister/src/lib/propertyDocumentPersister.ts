import { MongoDB } from 'infrastructure-node-dbutils'
import { ResoDocumentPersister } from './resoDocumentPersister'
import { Legacy } from 'etl'
import { ILogger } from 'infrastructure-logging-lib'
import { getDefault } from '../config'
import { ObjectID } from 'mongodb'
import * as _ from 'lodash'
import * as moment from 'moment'

export class PropertyDocumentPersister extends ResoDocumentPersister<Legacy.Listings.Listing> {
  static collectionName = getDefault('persister.propertyCollection', 'listings')
  static idFields = getDefault('persister.idFields', 'import_id,feed_id').split(',')
  resoType: 'property'
  constructor(logger: ILogger) {
    super(logger)
  }
  getFilter(doc: Legacy.Listings.Listing) {
    return {
      'import_id': ResoDocumentPersister.parseObjectID(doc.import_id),
      'feed_id': doc.feed_id
    }
  }
  getUpdate(doc: Legacy.Listings.Listing) {
    return {
      $set: _.has(doc, '_id') ? _.omit(doc, ['_id']) : doc,
      $setOnInsert: {
        'created_at': `${moment.utc().format('YYYY-MM-DD HH:mm:ss')}.000Z`
      }
    }
  }
  getCollectionName() {
    return PropertyDocumentPersister.collectionName
  }
  generateIdHexString(doc: Legacy.Listings.Listing) {
    if (doc._id) {
      return ResoDocumentPersister.objectIDToString(doc._id)
    }
    return MongoDB.genHashForObjectId(
      _.map(PropertyDocumentPersister.idFields, function (field: string) {
        return ResoDocumentPersister.objectIDToString(_.get(doc, field, ''))
      }))
  }
  isValidDocument(doc: Legacy.Listings.Listing) {
    if (doc.import_id && (doc.mls_id || doc.feed_id)) {
      // if we have an import id and either an mls or feed id, this is a good id
      return true
    } else {
      this.logger.audit(
        'PropertyDocumentPersister.isValidDocument', 'warn',
        { _id: doc._id, import_id: doc.import_id, mls_id: doc.mls_id, feed_id: doc.feed_id })
      return false
    }
  }
}
