/// <reference path="../definitions/index.d.ts" />

import * as config from 'config'
import { MongoClient, Db, Cursor, MongoClientOptions } from 'mongodb'
import { Legacy, ILogger } from 'etl'
import * as Promise from 'bluebird'

interface ConfigDef {
  mongoConnection: string,
  tableName: string,
  mongoClientOptions?: MongoClientOptions
}

function returnAllItemsFromCursor<TItem>(cursor: Cursor<TItem>) {
  return new Promise((resolve, reject) => {
    let items: TItem[] = []
    cursor.stream()
    cursor.on('data', function (data: TItem) {
      items.push(data)
    })
    cursor.once('end', function () {
      resolve(items)
    })
  })
}

export default class MongoDbRepository {
  private options: ConfigDef = {
    tableName: config.get<string>('dispatcher.tableName'),
    mongoConnection: config.get<string>('dispatcher.mongoConnection'),
    mongoClientOptions: config.has('mongoClientOptions')
      ? config.get<MongoClientOptions>('mongoClientOptions')
      : null
  }
  constructor(
    private docClient: MongoClient,
    private logger: ILogger
  ) { }

  public getScheduledImports<T>(key: string) {
    let queryParams = {
      'ETLServiceConfig.scheduleId': key,
      is_active: true
    }
    let mongoClientOptions = config.util.extendDeep(
      { promiseLibrary: Promise },
      this.options.mongoClientOptions) as MongoClientOptions
    const promiseForImports = Promise.resolve(this.docClient.connect(this.options.mongoConnection, mongoClientOptions))
      // http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html#db
      // return the placester_production db, in case of authentication connection
      .then(db => db.db(config.get<string>('dispatcher.mongoDatabase')))
      .then((db: Db) => {
        const resultsPromise = db.collection(this.options.tableName)
          .find(queryParams)
        return Promise.resolve(resultsPromise)
          .then(returnAllItemsFromCursor)
      })
    return promiseForImports as Promise<T[]>
  }
}
