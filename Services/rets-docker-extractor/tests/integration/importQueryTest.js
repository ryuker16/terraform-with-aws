/* eslint-env mocha */
/* DEBUG=rets-client* mocha __filename */
'use strict'
require('reflect-metadata')
const RetsClientService = require('../../dist/lib/rets/retsClientService').RetsClientService
const RetsImporterService = require('../../dist/lib/rets/retsImporterService').RetsImporterService
const path = require('path')
const rets = require('rets-client')
const getLogger = require('infrastructure-logging-lib').getLogger
const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const fs = require('fs')
const Promise = require('bluebird')
const _ = require('lodash')
const ImportMapper = require('../../../extract-dispatcher/dist/src/legacyImportMapper').default
Promise.promisifyAll(mongodb)

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

// print process.argv
process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`)
})

var testImportQueries = function () {
  let service = new RetsClientService(rets, logger)
  let importer = new RetsImporterService(service, logger)
  let db = null
  let imports = []
  let limit = 21
  let skip = 0

  let client = new MongoClient()
  return Promise.resolve(client
    // mongo ec2-54-218-48-172.us-west-2.compute.amazonaws.com:29000
    // smb-mongo-24poc1
    // NODE_ENV=test mocha ./tests/integration/importServiceMetaTest.js
    .connect('mongodb://ec2-54-218-48-172.us-west-2.compute.amazonaws.com:29000'))
    .then((db) => {
      return db.db('placester_production')
    })
    .then((database) => {
      db = database
      let query = { is_active: true, core_class: 'RETS', 'ETLServiceConfig.scheduleId': 'RETS15' }
      if (process.env.IMPORT_ID) {
        query._id = new mongodb.ObjectId(process.env.IMPORT_ID)
        // console.log('_id', query._id)
      }
      // console.log('query', query)
      return db.collection('imports')
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArrayAsync()
    })
    .then(importsArray => {
      logger.info({ urls: _.map(importsArray, (i) => _.partialRight(_.get, 'url')(i)) })
      imports = importsArray
      fs.writeFileSync(path.resolve(__dirname, 'logs/', 'imports.json.log'), JSON.stringify({ imports: importsArray }))
    })
    .then(() => {
      return Promise.map(
        imports,
        function (myImport) {
          let mapper = new ImportMapper()
          let extractionRequest = mapper.buildExtractionRequest(myImport, {})
          for (let i = 0; i < extractionRequest.config.resources.length; i++) {
            extractionRequest.config.resources[i].limit = 1
            extractionRequest.config.resources[i].offset = 1
            extractionRequest.config.resources[i].limitCalls = 1
          }
          let myPath = path.resolve(__dirname, 'logs/', `${myImport._id}.json.log`)
          let errPath = path.resolve(__dirname, 'logs/', `${myImport._id}.err.json.log`)
          return importer.importListings(extractionRequest.config)
            .then((result) => {
              logger.info('import with query', { extractionRequest })
              fs.writeFileSync(myPath, JSON.stringify({ result }))
              return result
            })
            .catch((err) => {
              logger.error(err)
              fs.writeFileSync(errPath, JSON.stringify({ err, myImport }))
              return err
            })
            /* .then(function (result) {
              console.log('RESULT FROM IMPORT: ' + JSON.stringify(result))
            }) */
        })
    })
    .then(console.log.bind(console))
    .catch(console.error.bind(console))
    .finally(() => {
      if (db) {
        db.close()
      }
      process.exit(0)
    })
}

var promisething = Promise.resolve(testImportQueries())
// console.log(promisething)
