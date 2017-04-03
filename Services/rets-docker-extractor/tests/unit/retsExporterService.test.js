/* eslint-env mocha */
'use strict'
require('reflect-metadata')
const _module = require('src/lib/rets/retsExporterService')
const RetsExporterService = _module.RetsExporterService
const RetsExporterServiceFactory = _module.RetsExporterServiceFactory
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const Promise = require('bluebird')
const expect = chai.expect
const shortid = require('shortid')
const awsrequest = require('./awsrequest')
const _ = require('lodash')
const Rx = require('rx')
const Faker = require('faker')

const genClassResponse = function (r, c, count, classIndex) {
  let result = {
    // property must be a real value because of config.get('exportTopicArns.*')
    resoType: 'property',
    resourceName: r,
    className: c,
    results: [],
    retsDocumentImagesTuples: [],
    // classModel would have been appended by Importer
    classModel: {
      purchaseType: shortid.generate()
    },
    classIndex
  }
  _.times(count, (n) => {
    let doc = { prop: shortid.generate(), resultIndex: n, classIndex }
    result.results.push(doc)
    result.retsDocumentImagesTuples.push({ retsDocumentBody: doc })
  })
  return result
}
const genResourceClassResponse = function (count, resourceIndex) {
  let result = {
    // property must be a real value because of config.get('exportTopicArns.*')
    resoType: 'property',
    classes: [],
    resourceName: shortid.generate(),
    resourceIndex
  }
  _.times(count, (n) => result.classes.push(genClassResponse(result.resourceName, shortid.generate(), count, n)))
  return result
}
const genImportListingsResponse = function (count) {
  let result = {
    resources: []
  }
  _.times(count, (n) => result.resources.push(genResourceClassResponse(count, n)))
  return result
}

const genImportImageTuplesResponse = function (count) {
  let retsDocumentImagesTuples = []
  let retsDocumentImages = []
  let RetsDocumentImagesTuple = {
    retsDocumentBody: shortid.generate(),
    retsDocumentImages: []
  }
  let imageResponse = {
    headerInfo: {
      contentType: 'string',
      contentId: shortid.generate(),
      objectId: shortid.generate(),
      location: 'location'
    }
  }
  _.times(count, function () {
    retsDocumentImages.push(imageResponse)
  })
  RetsDocumentImagesTuple.retsDocumentImages = retsDocumentImages

  _.times(count, function () {
    retsDocumentImagesTuples.push(RetsDocumentImagesTuple)
  })

  // let classResponse = retsDocumentImagesTuples
  let classResponse = {
    resoType: 'property',
    resourceName: 'resourceName',
    'className': 'className',
    'results': [],
    classModel: {
      purchaseType: shortid.generate()
    },
    retsDocumentImagesTuples: retsDocumentImagesTuples
  }

  return classResponse
}

let retsDocumentExtracted = {
  retsDocumentLocation: {
    region: '',
    bucket: '',
    key: ''
  },
  className: 'retsDocumentMetadata.className',
  resourceName: 'retsDocumentMetadata.resourceName',
  retsDocumentBody: {},
  retsDocumentImages: []
}

let sampleExtractionRequest = {
  schedule: {
    name: shortid.generate()
  },
  context: {
    correlationID: shortid.generate(),
    importId: shortid.generate()
  },
  config: {
    'protocol': 'RETS',
    'name': shortid.generate(),
    'connection': {
      'url': shortid.generate(),
      'username': shortid.generate(),
      'password': shortid.generate()
    }
  }
}

let sampleImportResourceClassResponse = {
  resoType: 'ResoType',
  resourceName: 'string',
  className: 'string',
  query: 'string',
  results: ['1', '2'],
  classModel: 'classModel'
}

describe('RetsExporterService', function () {
  let exporter = null
  let s3 = null
  let logger = null
  let firehose = null
  let expectedError = null
  let extractionRequest = null
  let FIREHOSE_BUFFER_COUNT = 0
  let FIREHOSE_CONCURRENCY = 0
  let sandbox = null
  beforeEach(() => {
    sandbox = sinon.sandbox.create()
    s3 = sandbox.stub({
      putObject: () => { }
    })
    logger = sandbox.stub({
      boundary: () => { },
      audit: () => { },
      info: () => { },
      error: () => { },
      telemetry: () => {}
    })
    firehose = sandbox.stub({
      putRecordBatch: () => { }
    })
    expectedError = new Error(shortid.generate())
    extractionRequest = _.cloneDeep(sampleExtractionRequest)
    exporter = new RetsExporterService(firehose, logger)
    exporter.FIREHOSE_BUFFER_COUNT = (FIREHOSE_BUFFER_COUNT = Faker.random.number({ min: 5, max: 10 }))
    console.log('FIREHOSE_BUFFER_COUNT', exporter.FIREHOSE_BUFFER_COUNT, FIREHOSE_BUFFER_COUNT)
    exporter.FIREHOSE_CONCURRENCY = (FIREHOSE_CONCURRENCY = Faker.random.number({ min: 2, max: 4 }))
    console.log('FIREHOSE_CONCURRENCY', exporter.FIREHOSE_CONCURRENCY, FIREHOSE_CONCURRENCY)
  })
  afterEach(function () {
    sandbox.restore()
  })
  it('should export class', function () {
    expect(RetsExporterService).to.be.a('function')
  })
  describe('constructor', function () {
    xit('should throw without s3', function () {
      expect(() => {
        return new RetsExporterService()
      }).to.throw(TypeError)
    })
    xit('should throw without sns', function () {
      expect(() => {
        return new RetsExporterService({ putObject: _.noop }, null)
      }).to.throw(TypeError)
    })
    xit('should throw without logger', function () {
      expect(() => {
        return new RetsExporterService({ putObject: _.noop }, { publish: _.noop })
      }).to.throw(TypeError)
    })
    it('should be ok with s3 and sns and logger', function () {
      expect(() => {
        return new RetsExporterService({ putObject: _.noop }, { publish: _.noop }, logger)
      }).to.not.throw
    })
  })
  describe('methods', function () {
    it('should return a promise', function (done) {
      var promise = exporter.exportListings()
      expect(promise.then).to.be.a('function')
      expect(promise.catch).to.be.a('function')
      promise.catch(() => done())
    })
    it('should reject a TypeError without ETL.Extraction.Request', function (done) {
      Promise.resolve(exporter.exportListings())
        .catch((err) => {
          expect(err).to.be.instanceOf(TypeError)
          done()
        })
    })
    it('should reject a TypeError without ImportListingsResponse', function (done) {
      Promise.resolve(exporter.exportListings())
        .catch((err) => {
          expect(err).to.be.instanceOf(TypeError)
          done()
        })
    })
    describe('buildPutObjectRequest(extractionRequest, resourceClassResponse, document)', function () {
      it('should return RetsDocumentExtracted with { retsDocumentBody, context, retsDocumentMetadata}', function () {
        let resourceClassResponse = _.cloneDeep(sampleImportResourceClassResponse)
        let retsDocumentImagesTuple = {
          retsDocumentBody: shortid.generate(),
          retsDocumentImages: []
        }
        let result = RetsExporterService.buildPutObjectRequest(extractionRequest, resourceClassResponse, retsDocumentImagesTuple)
        let extractedBody = JSON.parse(result.Body)
        expect(extractedBody.retsDocumentMetadata).to.contain.any.keys('resoType', 'resourceName')
        expect(extractedBody.retsDocumentBody).to.be.eq(retsDocumentImagesTuple.retsDocumentBody)
        expect(extractedBody).to.have.property('context').that.is.deep.eq(sampleExtractionRequest.context)
      })
    })
    describe('exportListings(extractionRequest, listingsResponse) to firehose', function () {
      var buildRetsDocumentExtractedFromTupleSpy = null
      var putExtractionRequestBatchToFirehoseStub = null
      // random number of resources, classes, results
      var genCount = 2
      // genCount ^ 3
      var expectedResultCount = 8
      var importResponse = null
      beforeEach(function () {
        genCount = Faker.random.number({ min: 3, max: 5 })
        console.log('genCount is ', genCount)
        expectedResultCount = Math.pow(genCount, 3)
        console.log('expectedResultCount is', expectedResultCount)
        importResponse = genImportListingsResponse(genCount)
        extractionRequest.config.resources = importResponse.resources
        buildRetsDocumentExtractedFromTupleSpy = sandbox.spy(exporter, 'buildRetsDocumentExtractedFromTuple')
        putExtractionRequestBatchToFirehoseStub = sandbox.stub(exporter, 'putExtractionRequestBatchToFirehose')
      })
      afterEach(function () {
        buildRetsDocumentExtractedFromTupleSpy.restore()
        putExtractionRequestBatchToFirehoseStub.restore()
      })
      it('should build an extraction request for each resource class results', function () {
        putExtractionRequestBatchToFirehoseStub.rejects(expectedError)
        return exporter.exportListings(extractionRequest, importResponse)
          .then(expect.fail)
          .catch((err) => {
            expect(buildRetsDocumentExtractedFromTupleSpy.callCount, 'buildRetsDocumentExtractedFromTuple callCount').to.be.eq(expectedResultCount)
            expect(err).to.be.eq(expectedError)
          })
      })
      it('should putExtractionRequestBatchToFirehoseStub in chunks of FIREHOSE_BUFFER_COUNT results', function () {
        putExtractionRequestBatchToFirehoseStub.returns(Promise.delay(Faker.random.number(200)))
        return exporter.exportListings(extractionRequest, importResponse)
          .then(() => {
            expect(buildRetsDocumentExtractedFromTupleSpy.callCount, 'buildRetsDocumentExtractedFromTuple callCount').to.be.eq(expectedResultCount)
            let firstExtractionRequestBatch = putExtractionRequestBatchToFirehoseStub.getCall(0).args[0]
            expect(firstExtractionRequestBatch).to.be.a('array')
            expect(firstExtractionRequestBatch.length, 'first buffer count').to.eq(FIREHOSE_BUFFER_COUNT)
            expect(putExtractionRequestBatchToFirehoseStub.callCount, `${FIREHOSE_BUFFER_COUNT} / ${expectedResultCount}`).to.eq(Math.ceil(expectedResultCount / FIREHOSE_BUFFER_COUNT))
          })
      })
      it('should not do more than putExtractionRequestBatchToFirehoseStub in chunks of FIREHOSE_CONCURRENCY', function () {
        let minBatches = Math.min(FIREHOSE_CONCURRENCY, Math.floor(expectedResultCount / FIREHOSE_BUFFER_COUNT))
        _.times(minBatches, (n) => {
          putExtractionRequestBatchToFirehoseStub.onCall(n).resolves()
        })
        _.times(minBatches, (n) => {
          putExtractionRequestBatchToFirehoseStub.onCall(n + minBatches).rejects(expectedError)
        })
        return exporter.exportListings(extractionRequest, importResponse)
          .then(expect.fail)
          .catch((err) => {
            expect(putExtractionRequestBatchToFirehoseStub.callCount, 'called at least minBatches')
              .to.be.at.least(minBatches)
            expect(putExtractionRequestBatchToFirehoseStub.callCount, 'called at most 2 x FIREHOSE_CONCURRENCY before error')
              .to.be.at.most(2 * FIREHOSE_CONCURRENCY)
            expect(err).to.be.eq(expectedError)
          })
      })
    })// end exportListings(extractionRequest, listingsResponse) to firehose
    xdescribe('exportListings(extractionRequest, listingsResponse) to s3 and sns', function () {
      var exportResourceClassStub = null
      beforeEach(function () {
        exportResourceClassStub = sandbox.stub(exporter, 'exportResourceClass')
      })
      afterEach(function () {
        exportResourceClassStub.restore()
      })
      xit('should call exportResourceClass for each resource and class', function () {
        let importResponse = genImportListingsResponse(2)
        exportResourceClassStub.resolves({})
        exportResourceClassStub.onCall(3).resolves({ foo: 'bar' })
        extractionRequest.config.resources = importResponse.resources
        return exporter.exportListings(extractionRequest, importResponse)
          .then(function (result) {
            expect(result.foo).to.be.eq('bar')
            expect(exportResourceClassStub).to.have.callCount(4)
          })
      })
    })// end exportListings(extractionRequest, listingsResponse) to s3 and sns

    xdescribe('exportResourceClass', function () {
      it('should call s3 putObject for each resource, class, item', function () {
        let importResponse = genImportListingsResponse(1)
        extractionRequest.config.resources = importResponse.resources
        let expectedError = new Error(shortid.generate())
        s3.putObject.returns(awsrequest(sandbox.stub().rejects(expectedError)))
        return exporter.exportResourceClass(extractionRequest, importResponse, importResponse.resources[0].classes[0])
          .toArray()
          .toPromise()
          .then((results) => {
            expect(results).to.have.lengthOf(1)
            expect(results[0].err).to.be.equal(expectedError)
            expect(s3.putObject).to.have.callCount(1)
          })
      })
      it('should call s3 putObject for each resource, class, listing with multiples', function () {
        let importResponse = genImportListingsResponse(3)
        extractionRequest.config.resources = importResponse.resources
        extractionRequest.schedule.destination = {}
        let expectedError = new Error(shortid.generate())
        s3.putObject.returns(awsrequest(sandbox.stub().rejects(expectedError)))
        return exporter.exportResourceClass(extractionRequest, importResponse, importResponse.resources[0].classes[0])
          .toArray()
          .toPromise()
          .then((results) => {
            expect(results).to.have.lengthOf(3)
            expect(s3.putObject).to.have.callCount(3)
          })
      })
      it('should call s3 putObject for each resource, class, image with multiples', function () {
        let extractionRequest = _.cloneDeep(sampleExtractionRequest)
        let importResponse = genImportListingsResponse(1)
        let classResponse = genImportImageTuplesResponse(3)
        extractionRequest.config.resources = importResponse.resources
        extractionRequest.schedule.destination = {}
        let expectedError = new Error(shortid.generate())
        s3.putObject.returns(awsrequest(sandbox.stub().rejects(expectedError)))
        return exporter.exportResourceClassImageResponse(extractionRequest, importResponse, classResponse)
          .toArray()
          .toPromise()
          .then((results) => {
            console.log(results)
            expect(results).to.have.lengthOf(3)
            expect(s3.putObject).to.have.callCount(3)
          })
      })
    })// end exportResourceClass
  })// end methods
  describe('RetsExporterServiceFactory', function () {
    xit('should return RetsExporterService with AWS.S3, AWS.SNS, and logger', function () {
      let service = RetsExporterServiceFactory(null, logger)
      expect(service.logger).to.be.eq(logger)
      expect(service.s3).to.be.instanceOf(require('aws-sdk').S3)
      expect(service.sns).to.be.instanceOf(require('aws-sdk').SNS)
    })
  })// end RetsExporterServiceFactory
  describe('isResourceClassImageResponse', function () {
    xit('should return true with a retsDocumentImagesTuples array', function () {
      let result = _module.isResourceClassImageResponse({ retsDocumentImagesTuples: [] })
      expect(result).to.be.ok
    })
  })// end isResourceClassImageResponse
  describe('testing examples with flatMap', function () {
    it('testing flatMap', function () {
      let er = { context: { importId: Faker.random.uuid() } }
      let importListingsResponse = genImportListingsResponse(3)
      let source = Rx.Observable.fromArray(importListingsResponse.resources)
        .flatMap((resourceResponse) => Rx.Observable.fromArray(resourceResponse.classes))
        .flatMap(
        function selectResults (classResponse) {
          return Rx.Observable.fromArray(classResponse.results)
        })
        .map(function mapExtractionRequest (result) {
          return _.assign({}, er, { retsDocumentBody: result })
        })
        .bufferWithCount(3)
        .flatMapWithMaxConcurrent(
        2,
        function doPutRecordBatch (results) {
          console.log('defer', results.length, 'results')
          return Rx.Observable.defer(function () {
            console.log('processing', results.length, 'results')
            return Promise.map(results, (result, i) => Promise.delay(100 * i).then(function () {
              console.log('processed result', i)
              return result
            }))
          })
        })
      return source
        .doOnNext((item) => console.log('Next', item))
        .toPromise(Promise)
    })
  })// end testing examples with flatMap
  describe('putExtractionRequestBatchToFirehose', function () {
    it('should putRecordBatch with the configured DeliveryStreamName', function () {
      let expectedName = Faker.name.firstName()
      RetsExporterService.DELIVERY_STREAM_NAME = expectedName
      let retsDocumentExtractedArray = [retsDocumentExtracted, retsDocumentExtracted]
      firehose.putRecordBatch.returns(awsrequest(sandbox.stub().rejects(expectedError)))
      return exporter.putExtractionRequestBatchToFirehose(retsDocumentExtractedArray)
        .then(expect.fail)
        .catch((err) => {
          expect(err).to.be.eq(expectedError)
          expect(firehose.putRecordBatch).to.have.been.calledWith(sandbox.match.has('DeliveryStreamName', expectedName))
        })
    })
    it('should putRecordBatch and reject if putRecordBatch does', function () {
      let retsDocumentExtractedArray = _.times(Faker.random.number({ min: 5, max: 10 }), () => retsDocumentExtracted)
      firehose.putRecordBatch.returns(awsrequest(sandbox.stub().rejects(expectedError)))
      return exporter.putExtractionRequestBatchToFirehose(retsDocumentExtractedArray)
        .then(expect.fail)
        .catch((err) => {
          expect(err).to.be.eq(expectedError)
        })
    })
    it('should putRecordBatch with same number of mapped ExtractionRequest and audit', function () {
      let retsDocumentExtractedArray = _.times(Faker.random.number({ min: 5, max: 10 }), () => retsDocumentExtracted)
      firehose.putRecordBatch.returns(awsrequest(sandbox.stub().rejects(expectedError)))
      return exporter.putExtractionRequestBatchToFirehose(retsDocumentExtractedArray)
        .then(expect.fail)
        .catch((err) => {
          expect(err).to.be.eq(expectedError)
          expect(firehose.putRecordBatch.getCall(0).args[0].Records).to.have.lengthOf(retsDocumentExtractedArray.length)
          expect(logger.telemetry).to.have.been.calledWith(
            'RetsExporterService.putRecordBatch',
            'records',
            'count',
            retsDocumentExtractedArray.length,
            sinon.match.any)
        })
    })
  })// end putExtractionRequestBatchToFirehose
}) // end RetsExporterService
