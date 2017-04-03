/* eslint-env mocha */
/* DEBUG=rets-client* mocha __filename */
/**
 * gulp build
 * NODE_ENV=test DEBUG=rets-client* node tools/importQueryTest.js
 * options:
 * --importId string
 * --scheduleId string
 * --take number
 * --skip number
 */
'use strict'
require('reflect-metadata')
const path = require('path')
require('app-module-path').addPath(path.resolve(__dirname, '../dist'))
require('app-module-path').addPath(path.resolve(__dirname, '../tests'))
const RetsClientService = require('src/lib/rets/retsClientService').RetsClientService
const RetsImporterService = require('src/lib/rets/retsImporterService').RetsImporterService
const RetsExporterService = require('src/lib/rets/retsExporterService').RetsExporterService
const getLogger = require('infrastructure-logging-lib').getLogger
const rets = require('rets-client')
const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const jfs = require('jsonfile')
const fs = require('fs-extra')
// const RxNode = require('rx-node')
const Rx = require('rx')
const Promise = require('bluebird')
Promise.promisifyAll(jfs)
Promise.promisifyAll(fs)
const config = require('config')
const _ = require('lodash')
const shortid = require('shortid')
const mongoConnection = config.get('mongoConnection')
var argv = require('minimist')(process.argv.slice(2))
console.log({ argv: argv })
const context = {
  correlationID: shortid.generate()
}
console.log('context', context)
// const Writeable = require('stream').Writable
const ImportMapper = require(path.resolve(__dirname, '../../extract-dispatcher/dist/src/legacyImportMapper')).default
// folder based requires
Promise.promisifyAll(mongodb)
const logStreams = []
// logStreams.push({ level: 'debug', stream: process.stdout })
logStreams.push({
  type: 'rotating-file',
  path: path.resolve(__dirname, 'logs/', `${path.basename(__filename)}.log`),
  period: '1h', // hour rotation
  count: 3 // keep 3 back copies
})
const logger = getLogger(path.basename(__filename), 'rets-docker-extractor', context, {
  streams: logStreams
})
class FirehoseMock {
  /**
   * Bucket, Key, Body
   */
  putObject (request) {
    let filename = path.resolve(
      __dirname,
      'logs/',
      `${request.Bucket}/`,
      `${context.correlationID}/`,
      request.Key)
    return {
      promise: () => {
        return fs.ensureDirAsync(path.dirname(filename))
          .then(() => {
            return jfs.writeFileAsync(filename, JSON.parse(request.Body), { spaces: 2 })
          })
      }
    }
  }
  /**
   * Write records send to Firehose to
   * /logs/putRecordBatch/correlationID-X/batchID-X
   */
  putRecordBatch (request) {
    let filename = path.resolve(
      __dirname,
      'logs/',
      'putRecordBatch/',
      `correllationID-${context.correlationID}/`,
      `batchID-${shortid.generate()}.json`)
    return {
      promise: () => {
        return fs.ensureDirAsync(path.dirname(filename))
          .then(() => {
            console.log('writing', filename)
            return jfs.writeFileAsync(filename, request, { spaces: 2 })
          })
      }
    }
  }
}

const service = new RetsClientService(rets, logger)
const importer = new RetsImporterService(service, logger)
const exporter = new RetsExporterService(new FirehoseMock(), logger)
const mapper = new ImportMapper()

function getQuery () {
  let query = {
    is_active: true,
    core_class: 'RETS'
  }
  if (argv.scheduleId) {
    query['ETLServiceConfig.scheduleId'] = argv.scheduleId
  }
  if (argv.importId) {
    query._id = new mongodb.ObjectId(argv.importId)
  }
  return query
}

let db = null
function queryImports () {
  let client = new MongoClient()
  let take = argv.take || 10
  let skip = argv.skip || 0
  console.log('connecting to', mongoConnection)
  return Promise.resolve(client.connect(mongoConnection))
    .then((db) => {
      console.log('connected', { databaseName: db.databaseName })
      return db.db('placester_production')
    })
    .then((database) => {
      db = database
      let query = getQuery()
      logger.debug('query imports', { query })
      return db.collection('imports')
        .find(query)
        .skip(skip)
        .limit(take)
        .toArrayAsync()
    })
}

function handleImportError (importDoc, extractionRequest, dir, err) {
  console.error(err)
  // write the err to the extraction dir
  jfs.writeFileSync(
    path.resolve(dir, `err.json`), { err, extractionRequest, importDoc },
    { spaces: 2 })
}
function handleImportResult (importDoc, extractionRequest, dir, importListingsResponse) {
  console.log('handleImportResult', importDoc._id)
  let selectClasses = function (resourceResult) {
    // console.log('selectClasses')
    return resourceResult.classes || []
  }
  let writeFile = function (filename, contents, callback) {
    // console.log('writeFile')
    jfs.writeFile(path.resolve(dir, filename), contents, { spaces: 2 }, callback)
  }
  // write the entire import response
  let writeResponse = jfs.writeFileAsync(path.resolve(dir, `importListingsResponse.json`),
    { extractionRequest, importListingsResponse },
    { spaces: 2 })
  let source = Rx.Observable.fromArray(importListingsResponse.resources)
    .selectMany(selectClasses)
    .flatMap((classResponse) => {
      let filename = `classResponse-${classResponse.className}.json`
      console.log('writing', filename)
      return Promise.promisify(writeFile)(
        filename,
        _.omit(classResponse, ['results', 'retsDocumentImagesTuples']))
    })
  let logListings = source.toPromise(Promise)
  let exportListings = exporter.exportListings(extractionRequest, importListingsResponse)
  return Promise.all([writeResponse, logListings, exportListings])
}

var main = function (context) {
  return Rx.Observable.fromPromise(queryImports())
    .tap((imports) => console.log(`returned ${imports.length} imports`))
    .selectMany(imports => imports)
    .flatMap(
      (importResponse) => {
        let extractionRequest = mapper.buildExtractionRequest(importResponse, context)
        _.forEach(extractionRequest.config.resources, (resource) => {
          _.forEach(resource.queries, function (rq) {
            // note - functionality is not yet respected
            rq.limit = 2
            rq.offset = 0
          })
          resource.limit = 2
          resource.offset = 0
          resource.limitCalls = 2
        })
        return Rx.Observable.just(extractionRequest)
      },
      (importResponse, extractionRequest) => {
        return { importResponse, extractionRequest }
      })
    .flatMapWithMaxConcurrent(
      3,
      (tuple) => Rx.Observable.defer(() => {
        let importResponse = tuple.importResponse
        let extractionRequest = tuple.extractionRequest
        console.log('importDoc', importResponse._id)
        console.log('importing', {
          importId: tuple.importResponse._id,
          url: tuple.importResponse.url,
          name: tuple.importResponse.name
        })
        let dir = path.resolve(
          __dirname,
          'logs/',
          `correlationID-${extractionRequest.context.correlationID}/`,
          `importId-${extractionRequest.context.importId}/`)
        let processImport = Promise.any([fs.existsAsync(dir), fs.mkdirsAsync(dir)])
          .then(() => importer.importListings(extractionRequest.config))
          .then(handleImportResult.bind(null, importResponse, extractionRequest, dir))
          .catch(handleImportError.bind(null, importResponse, extractionRequest, dir))
        return processImport
      }))
    .tapOnError(console.error.bind(console, 'tapOnError'))
    .toPromise(Promise)
}

fs.ensureDirSync(path.resolve(__dirname, 'logs/'))
let then = process.hrtime()
Promise.resolve(main(context))
  .finally(() => {
    if (db) { db.close() }
    let delta = process.hrtime(then)
    console.log('duration', delta[0], 's', delta[1] / 1000000, 'ms')
    process.exit(0)
  })
