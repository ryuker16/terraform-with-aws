/* eslint-env mocha */
/* DEBUG=rets-client* mocha __filename */

/**
 * HOW TO RUN
 *
 * node tools/importMetadtaTool.js --{option} {value}
 *
 * Options are as follows:
 *
 * --skip {n} // skip n records
 * --url {url} // Import URL 'url'
 * --importid {import_id} // Import Object ID 'objectId'
 * --username {rets acct username} // test single account using username (assumes they are unique)
*/

'use strict'
require('reflect-metadata')
console.log('dirname', __dirname)
const path = require('path')
require('app-module-path').addPath(path.resolve(__dirname, '../dist'))
const RetsClientService = require('src/lib/rets/retsClientService').RetsClientService
const RetsImporterService = require('src/lib/rets/retsImporterService').RetsImporterService
require('app-module-path').addPath(path.resolve(__dirname, '../tests'))
const getLogger = require('infrastructure-logging-lib').getLogger
const rets = require('rets-client')
const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const ObjectId = mongodb.ObjectId
const fs = require('fs-extra')
const Promise = require('bluebird')
const _ = require('lodash')
const config = require('config')
// load minimist module to access argv object
var argv = require('minimist')(process.argv.slice(1))
Promise.promisifyAll(mongodb)
Promise.promisifyAll(fs)

const logger = getLogger(path.basename(__filename), 'rets-docker-extractor', null, {
  streams: [{
    stream: process.stdout
  }, {
    type: 'rotating-file',
    path: path.resolve(__dirname, 'logs/', `${path.basename(__filename)}.log`),
    period: '1d', // daily rotation
    count: 3 // keep 3 back copies
  }]
})

if (process.env.NODE_ENV !== 'test') {
  throw new Error('NODE_ENV is not test')
}

// print process.argv
process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`)
})

let db = null
const main = function () {
  let service = new RetsClientService(rets, logger)
  let importer = new RetsImporterService(service, logger)
  let imports = []
  let limit = 5       // the limit to the number of feeds pulled from a query
  let skip = 0        // stores Skip parameter for skip records in query
  let importid = null // stores ObjectID paramater if passed
  let url = null      // stores URL parameter if passed
  let username = null  // stores RETS Feed Username if passed
  let mongoConnection = config.get('mongoConnection')

  // check to see if a skip argument was passed to code
  if (argv.skip > 0) {
    skip = argv.skip
  }

  // check to see if an ObjectId was passed to code
  if (argv.importid != null) {
    importid = argv.importid
  }

  // check to see if an argument was passed to code
  if (argv.url != null) {
    url = argv.url
  }

  // check to see if an argument was passed to code
  if (argv.username != null) {
    username = argv.username
  }

  if (argv.mongoconnection != null) {
    mongoConnection = argv.mongoconnection
  }

  let client = new MongoClient()
  return Promise.resolve(client.connect(mongoConnection))
    .then((db) => {
      return db.db('placester_production')
    })
    .then((database) => {
      db = database

      let query = null

      // Check for options (parameters) and query accordingly
      if (importid > '') {
        logger.info('Searching for Import with id: ' + importid)
        query = { _id: ObjectId(importid) }
      } else if (url > '') {
        query = { url: url, is_active: true }
      } else if (username > '') {
        query = { username: username, is_active: true }
      } else {
        query = { is_active: true, core_class: 'RETS' }
      }

      if (process.env.IMPORT_ID) {
        query._id = new mongodb.ObjectId(process.env.IMPORT_ID)
        console.log('_id', query._id)
      }
      console.log('query', query)
      return db.collection('imports')
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArrayAsync()
    })
    .then(importsArray => {
      let retsUrl = { urls: _.map(importsArray, (i) => _.partialRight(_.get, 'url')(i)) }

      logger.info('These are the rets urls: ' + retsUrl)
      imports = importsArray
      return fs.writeFileAsync(path.resolve(__dirname, 'logs/', 'imports.json'), JSON.stringify({ imports: importsArray }))
    })
    .then(() => {
      let myRetsConnections = imports.map(mapImportToRetsConnection)
      console.log('myRetsConnections', myRetsConnections)
      return Promise.map(
        myRetsConnections,
        function (retsConnection) {
          retsConnection.requestDebugFunction = function (type, data) {
            console.log('REQUEST DEBUG FUNCTION', type, data)
          }
          let myPath = path.resolve(__dirname, 'logs/', `${retsConnection._id}.metadata.json`)
          let errPath = path.resolve(__dirname, 'logs/', `${retsConnection._id}.metadata.err.jsong`)
          return Promise.resolve(importer.importMetadata(retsConnection))
            .tap((result) => {
              logger.info('importMetadata', { retsConnection })
              return fs.writeFileAsync(myPath, JSON.stringify({ result }))
            })
            .catch((err) => {
              logger.error(err)
              fs.writeFileSync(errPath, JSON.stringify({ err, retsConnection }))
              return err
            })
            .then(function (result) {
              var metaDoc
              if (result.name === 'RetsServerError' || result instanceof Error) {
                metaDoc = {
                  errors: result,
                  metadata: null,
                  retsConnection: retsConnection
                }
              } else {
                metaDoc = {
                  metadata: result,
                  errors: null,
                  retsConnection: retsConnection
                }
              }
              return Promise.fromCallback(function (callback) {
                return db.collection('imports_metadata').updateOne(
                  { '_id': new ObjectId(retsConnection._id) },
                  { $set: metaDoc },
                  { upsert: true },
                  callback)
              })
                .then(function (response) {
                  console.log(response)
                  return {
                    nModified: response.result.nModified,
                    ok: response.result.ok,
                    n: response.result.n
                  }
                })
            })
        })
    })
    .then(console.log.bind(console))
    .catch(console.error.bind(console))
}

const mapImportToRetsConnection = function (legacyImport) {
  return {
    username: legacyImport.username,
    password: legacyImport.password,
    userAgent: legacyImport.ua_username,
    userAgentPassword: legacyImport.ua_password,
    url: legacyImport.url,
    version: legacyImport.rets_version,
    _id: legacyImport._id
  }
}

fs.ensureDirSync(path.resolve(__dirname, 'logs/'))
let then = process.hrtime()
Promise.resolve(main())
  .finally(() => {
    if (db) { db.close() }
    let delta = process.hrtime(then)
    console.log('duration', delta[0], 's', delta[1] / 1000000, 'ms')
    process.exit(0)
  })
