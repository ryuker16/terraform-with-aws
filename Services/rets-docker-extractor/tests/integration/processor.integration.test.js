/* eslint-env mocha */
/* DEBUG=rets-client* mocha __filename */
/**
 * USAGE:
 * 1. npm run itestProcessor
 * NODE_ENV=test DEBUG=logginglib mocha -r tests/testpaths.js tests/integration/processor.integration.test.js
 *
 * Configuration:
 * 1. set IMPORT_ID=VALUE to override
 * 2. DEBUG=logginglib to output logs to console
 */
'use strict'
require('reflect-metadata')
const AWS = require('./sdk')
const path = require('path')
const Promise = require('bluebird')
const moment = require('moment')
const _ = require('lodash')
const config = require('config')
const container = require('src/container')
const getLogger = require('infrastructure-logging-lib').getLogger
const T = require('src/lib/types').default
const logger = getLogger(path.basename(__filename), 'ExtractProcessor', null, {
  streams: [{
    type: 'rotating-file',
    path: path.resolve(__dirname, 'logs/', `${path.basename(__filename)}.log`),
    period: '1d', // daily rotation
    count: 3 // keep 3 back copies
  }]
})
container.unbind(T.ILogger)
container.bind(T.ILogger).toConstantValue(logger)
const MongoClient = require('mongodb').MongoClient
const ObjectID = require('mongodb').ObjectID
Promise.promisifyAll(require('mongodb'))
const ImportMapper = require(path.resolve(__dirname, '../../../extract-dispatcher/dist/src/legacyImportMapper')).default

const mapper = new ImportMapper()
const extractProcessor = container.get(T.ExtractProcessor)
const sqs = new AWS.SQS()
const queueUrl = config.get('importQueueUrl')
console.log(queueUrl)
let DB = null

/**
 * read imports from mongo
 * map imports just like dispatcher does
 * output extraction requests to the test queue
 * trigger the ExtractProcessor to process the queue for one cycle
 */
describe('ExtractProcessor', function () {
  // 2 minutes
  this.timeout(2 * 60 * 1000)
  before(function () {
    let purgeQueue = sqs.purgeQueue({
      QueueUrl: queueUrl
    }).promise()
    let mongoConnection = config.get('mongoConnection')
    console.log('mongoConnection', mongoConnection)
    let connect = Promise.resolve((new MongoClient()).connect(mongoConnection))
      .then(db => {
        console.log('connected to ', db.databaseName)
        DB = db.db(config.get('mongoDatabase'))
      })
    return Promise.all([purgeQueue, connect])
  })
  beforeEach(() => {
    var now = moment()
    var diffMinutes = now.minutes() % 15
    var period = now.add(-diffMinutes, 'minutes').format('YYYY-MM-DD-HH-mm')
    var correlationID = new ObjectID().toString()
    let query = { is_active: true, core_class: 'RETS', 'ETLServiceConfig.scheduleId': 'RETS15' }
    let importId = ''
    if ((importId = process.env['IMPORT_ID'])) {
      console.log('using importId', importId)
      query._id = new ObjectID(importId)
    }
    console.log('query', query)
    let getImportsAsync = Promise.method(() => {
      return DB.collection('imports')
        .find(query)
        .limit(2)
        .toArrayAsync()
    })
    let mapImportsAsync = function (imports) {
      return _.map(imports, (myImport) => {
        console.log('mapping import', myImport._id)
        let extractionRequest = mapper.buildExtractionRequest(myImport, {
          correlationID,
          period,
          startTime: moment.utc().format()
        })
        for (let i = 0; i < extractionRequest.config.resources.length; i++) {
          extractionRequest.config.resources[i].limitCalls = 2
        }
        return extractionRequest
      })
    }
    let sendExtractionsToSQS = function (extractionRequests) {
      console.log('sending extractionRequests', queueUrl, extractionRequests.length)
      return sqs.sendMessageBatch({
        Entries: _.map(extractionRequests, (er) => {
          return {
            Id: er.context.importId,
            MessageBody: JSON.stringify(er)
          }
        }),
        QueueUrl: queueUrl
      }).promise()
    }
    return getImportsAsync()
      .then(mapImportsAsync)
      .then(sendExtractionsToSQS)
  })
  after(function () {
    if (DB) {
      DB.close()
    }
  })
  it('can process.start one round from the test queue', function () {
    this.timeout(3 * 60 * 1000)
    return extractProcessor.start()
  })
  it.only('can cycle the queue and exit when empty', function (done) {
    this.timeout(3 * 60 * 1000)
    let queueConsumer = container.get(T.QueueConsumer)
    queueConsumer.once('messages_received', console.log.bind(console, 'messages_received'))
    queueConsumer.once('message_received', console.log.bind(console, 'message_received'))
    queueConsumer.once('message_processed_error', done)
    queueConsumer.once('messages_processed_error', done)
    queueConsumer.once('empty', function () {
      console.log('queueConsumer empty')
      done()
    })
    extractProcessor.cycle().catch(done)
  })
})
