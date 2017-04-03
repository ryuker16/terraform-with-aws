/* eslint-env mocha */
/* DEBUG=rets-client* mocha __filename */
'use strict'
require('reflect-metadata')
const RetsClientService = require('src/lib/rets/retsClientService').RetsClientService
const RetsImporterService = require('src/lib/rets/retsImporterService').RetsImporterService
const path = require('path')
const rets = require('rets-client')
const chai = require('chai')
const expect = chai.expect
const config = require('config')
const getLogger = require('infrastructure-logging-lib').getLogger
const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const fs = require('fs')
const Promise = require('bluebird')
const _ = require('lodash')
Promise.promisifyAll(mongodb)

const mongoConnection = config.get('mongoConnection')

var matrixExtractionRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'matrixrets.realcomponline.extractionRequest.json')))

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

describe('RetsImporterService', function () {
  this.timeout(60 * 1000)
  var service
  var importer
  before(function () { })
  beforeEach(() => {
    service = new RetsClientService(rets, logger)
    importer = new RetsImporterService(service, logger)
  })
  it('can importListings from matrixretsrealcomponline', function () {
//    let importSettings = config.get('matrixretsrealcomponline')
    let importSettings = matrixExtractionRequest.config
    importSettings.resources[0].limitCalls = 1
    importSettings.resources[0].limit = 1
    return importer.importListings(importSettings)
      .then((data) => {
        logger.info('importListings resolved', data)
        expect(data).to.have.any.keys('resources')
        expect(data.resources).to.have.any.keys('Property')
        expect(data.resources['Property']).to.have.any.keys('classes')
        expect(data.resources['Property']['classes']).to.have.lengthOf(importSettings.resources[0].classes.length)
        expect(data.resources['Property']['classes'][0]).to.have.any.keys('className')
      })
  })
  describe('getting rets metadata', function () {
    let db = null
    let imports = []
    let limit = 10
    let skip = 0
    before(function () {
      let client = new MongoClient()
      return client
        .connect(mongoConnection)
        .then((db) => {
          return db.db('placester_production')
        })
        .then((database) => {
          db = database
          let query = { is_active: true, core_class: 'RETS' }
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
          logger.info({ urls: _.map(importsArray, (i) => _.partialRight(_.get, 'url')(i)) })
          imports = importsArray
          fs.writeFileSync(path.resolve(__dirname, 'logs/', 'imports.json.log'), JSON.stringify({ imports: importsArray }))
        })
    })
    after(function () {
      if (db) {
        return db.closeAsync()
      }
    })
    it('can getResources metadata from an is_active and core_class: RETS document', function () {
      let myRetsConnections = imports.map(mapImportToRetsConnection)
      console.log('myRetsConnections', myRetsConnections)
      return Promise.map(
        myRetsConnections,
        function (retsConnection) {
          let myPath = path.resolve(__dirname, 'logs/', `metadata.${retsConnection._id}.json.log`)
          return importer.importMetadata(retsConnection)
            .then((result) => {
              logger.info('did importMetadata', { result })
              return result
            })
            .catch((err) => {
              logger.error(err, { retsConnection })
            })
            .then(function (result) {
              fs.writeFileSync(myPath, JSON.stringify({ result: result }))
            })
        })
    })
  })
})

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
