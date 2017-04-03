/* eslint-env mocha */
/* DEBUG=rets-client* mocha __filename */
'use strict'
const RetsClientService = require('src/lib/rets/retsClientService').RetsClientService
const FieldFormats = require('src/lib/rets/retsClientService').FieldFormats
const RetsImporterService = require('src/lib/rets/retsImporterService').RetsImporterService
const path = require('path')
const rets = require('rets-client')
const chai = require('chai')
const expect = chai.expect
const config = require('config')
const getLogger = require('infrastructure-logging-lib').getLogger
const fs = require('fs')
const moment = require('moment')

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

var csretsExtractionRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'csrets.mris.com.extractionRequest.json')))
var matrixExtractionRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'matrixrets.realcomponline.extractionRequest.json')))
var flexmlsImageRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'flexmls.image.json')))

describe('retsClientService', function () {
  this.timeout(30 * 1000)
  var service
  before(function () { })
  beforeEach(() => {
    csretsExtractionRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'csrets.mris.com.extractionRequest.json')))
    matrixExtractionRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'matrixrets.realcomponline.extractionRequest.json')))
    flexmlsImageRequest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'samples/', 'flexmls.image.json')))
    service = new RetsClientService(rets, logger)
  })
  xit('can loadListings from calrets', function () {
    let calretsSettings = RetsImporterService.mapClientSettings(csretsExtractionRequest.config)
    return service.getClient(calretsSettings, function (client) {
      logger.info({ loginUrl: client.loginUrl }, 'getClient')
      return service.loadListings(
        client,
        csretsExtractionRequest.config.resources[0].resourceName,
        csretsExtractionRequest.config.resources[0].classes[0],
        '',
        { limit: 5 })
    }).then((data) => {
      logger.info({ data }, 'getClient & loadListings')
      expect(data).to.have.keys('results')
      expect(data).to.have.keys('responses')
    }, (err) => {
      logger.error({ err }, 'getClient & loadListings')
      throw err
    })
  })
  xit('can loadListings from matrixretsrealcomponline', function () {
    let importSettings = matrixExtractionRequest.config
    let clientSettings = RetsImporterService.mapClientSettings(importSettings)
    return service.getClient(clientSettings, function (client) {
      logger.info({ loginUrl: client.loginUrl }, 'getClient')
      return service.loadListings(client, importSettings.resources[0].resourceName, importSettings.resources[0].classes[0], importSettings.resources[0].query, { limit: 5, limitCalls: 2, offset: 0 })
    }).then((data) => {
      logger.info({ data }, 'getClient & loadListings')
    }, (err) => {
      logger.error({ err }, 'getClient & loadListings')
      throw err
    })
  })
  const testIncrementalListings = function (extractionRequest, options) {
    let clientSettings = RetsImporterService.mapClientSettings(extractionRequest.config)
    let resourceName = extractionRequest.config.resources[0].resourceName
    let className = extractionRequest.config.resources[0].classes[0].className
    let query = extractionRequest.config.resources[0].query
    return service.getClient(clientSettings, function (client) {
      logger.info({ loginUrl: client.loginUrl }, 'getClient')
      // RetsReplyError: RETS Server reply while attempting search - ReplyCode 20203 (MISC_SEARCH_ERROR); ReplyText: Offset value is out of the range 1 - 999999999
      return service.loadListings(client, resourceName, className, query, options)
    }).then((data) => {
      logger.info({ data }, 'getClient & loadListings')
      expect(data).to.have.any.keys('results', 'responses')
      let dates = data.results.map((result) => moment(result.ModificationTimestamp))
      let now = moment()
      for (var modificationDate in dates) {
        expect(now.subtract(modificationDate).days()).to.be.below(7, modificationDate)
      }
    }, (err) => {
      logger.error({ err }, 'getClient & loadListings')
      throw err
    })
  }
  it('can loadListings incrementally from calrets', function () {
    csretsExtractionRequest.config.resources[0].query += `,(ModificationTimestamp=${moment().add(-7, 'days').format(FieldFormats.DateTime)}+)`
    return testIncrementalListings(csretsExtractionRequest, { limit: 5, limitCalls: 2, offset: 1, restrictedIndicator: '' })
  })
  it('can loadListings incrementally from matrix', function () {
    matrixExtractionRequest.config.resources[0].query = `(Status=|ACTV,CCS),(PermitAddressInternetYN=1),(PermitInternetYN=1),(MatrixModifiedDT=${moment().add(-7, 'days').format(FieldFormats.DateTime)}+)`
    return testIncrementalListings(matrixExtractionRequest, { limit: 5, limitCalls: 2, offset: 1, restrictedIndicator: '' })
  })
  it('can load images from flex', function () {
    let flexSettings = RetsImporterService.mapClientSettings(flexmlsImageRequest.config)
    return service.getClient(flexSettings, function (client) {
      return service.importImages(
        client,
        flexmlsImageRequest.config.resources[0].resourceName,
        '16-100572', // want to pull this id out of the test
        'HiRes')
    }).then((data) => {
      expect(data.length).to.be.above(0)
    }, (err) => {
      logger.error({ err }, 'getClient & import images')
      throw err
    })
  })
  it('expect array with an error for an invaid id', function () {
    let flexSettings = RetsImporterService.mapClientSettings(flexmlsImageRequest.config)
    return service.getClient(flexSettings, function (client) {
      return service.importImages(
        client,
        flexmlsImageRequest.config.resources[0].resourceName,
        'id',
        'HiRes')
    }).then((data) => {
      expect(data.length).to.be.equal(1)
    })
  })
  it('can load images from calrets', function () {
    let settings = RetsImporterService.mapClientSettings(csretsExtractionRequest.config)
    return service.getClient(settings, function (client) {
      return service.importImages(
        client,
        'Property',
        '98828262654', // this should not be here
        'Photo')
        // get id from a load listings call, confirm image pull pulls down the correct number of images
    }).then((data) => {
      expect(data.length).to.be.above(0)
    })
  })
  it('can load images from matrix', function () {
    let settings = RetsImporterService.mapClientSettings(matrixExtractionRequest.config)
    return service.getClient(settings, function (client) {
      return service.importImages(
        client,
        'Property',
        '301327230', // this should not be here
        'Photo')
    }).then((data) => {
      expect(data.length).to.be.above(0)
    })
  })
})
