'use strict'
/* eslint-env mocha */
import { RetsFirehoseTransformer } from 'lib/retsFirehoseTransformer'
import { DocumentTransformer } from 'lib/documentTransformer'
import { FirehoseTransformer } from 'lib/firehoseTransformer'
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
const Faker = require('faker')
const _ = require('lodash')
const genRetsDocumentExtracted = require('../generators').genRetsDocumentExtracted

describe('RetsFirehoseTransformer', function () {
  describe('constructor', function () {
    it('should default the documentTransformerFactory ', function () {
      let transformer = new RetsFirehoseTransformer()
      expect(transformer.documentTransformerFactory).to.be.a('function')
    })
    it('should use the documentTransformerFactory', function () {
      let stub = sinon.stub()
      let transformer = new RetsFirehoseTransformer(null, stub)
      expect(transformer.documentTransformerFactory).to.be.eq(stub)
    })
    it('should default the documentTransformerFactory returning DocumentTransformer', function () {
      let transformer = new RetsFirehoseTransformer()
      expect(transformer.documentTransformerFactory({})).to.be.an.instanceOf(DocumentTransformer)
    })
    it('should default the firehoseTransformerFactory returning FirehoseTransformer with own transformationHandler', function () {
      let transformer = new RetsFirehoseTransformer()
      expect(transformer.firehoseTransformer).to.be.an.instanceOf(FirehoseTransformer)
      expect(transformer.firehoseTransformer.transformation).to.be.a('function')
    })
    it('should use the firehoseTransformerFactory', function () {
      let rde = genRetsDocumentExtracted(1)
      let stub = sinon.stub().returns(rde)
      let transformer = new RetsFirehoseTransformer(null, null, stub)
      expect(transformer.firehoseTransformer).to.be.eq(rde)
      expect(stub).to.have.been.called
    })
  })// end constructor

  describe('methods', function () {
    let records = []
    let sandbox = null
    let transformer = null
    let expectedError = null
    let randomCount = null
    let loggerStub = null
    let rde = null
    let documentTransformer = null
    beforeEach(function () {
      sandbox = sinon.sandbox.create()
      loggerStub = sandbox.stub({
        error: _.noop
      })
      randomCount = Faker.random.number({ min: 5, max: 20 })
      rde = genRetsDocumentExtracted(randomCount)
      transformer = new RetsFirehoseTransformer(loggerStub)
      expectedError = new Error(`Fake error ${Faker.random.uuid()}`)
      documentTransformer = sandbox.stub({
        transform: _.noop,
        enrich: _.noop,
        hydrate: _.noop,
        set: _.noop
      })
      documentTransformer.transform.resolves(documentTransformer)
      documentTransformer.enrich.resolves(documentTransformer)
    })
    afterEach(function () {
      sandbox.restore()
    })
    describe('run', function () {
      let processFirehoseRecords = null
      beforeEach(function () {
        processFirehoseRecords = sandbox.stub(transformer.firehoseTransformer, 'processFirehoseRecords')
      })
      it('should call FirehoseTransformer.processFirehoseRecords', function () {
        processFirehoseRecords.rejects(expectedError)
        return transformer.run({ records })
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(processFirehoseRecords).to.have.been.calledWith(sinon.match.has('records'))
          })
      })
    })
    describe('transformationHandler', function () {
      it('should wrap transformRetsDocumentExtracted and log and throw any errors', function () {
        let transformRetsDocumentExtracted = sandbox.stub(transformer, 'transformRetsDocumentExtracted')
        transformRetsDocumentExtracted.rejects(expectedError)
        return transformer.transformationHandler(rde)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(loggerStub.error).to.have.been.calledWith(expectedError)
          })
      })
      it('should wrap transformRetsDocumentExtracted and return success as record { data }', function () {
        let data = { property: Faker.random.uuid() }
        let transformRetsDocumentExtracted = sandbox.stub(transformer, 'transformRetsDocumentExtracted')
        transformRetsDocumentExtracted.resolves(data)
        return transformer.transformationHandler(rde)
          .then(transformationResult => {
            expect(transformationResult.data).to.be.eq(data)
          })
      })
    }) // end transformationHandler

    describe('transformRetsDocumentExtracted', function () {
      it('should ensureImages, create a DocumentTransformer, then transformRetsDocument', function () {
        let ensureRetsDocumentImagesSpy = sandbox.spy(transformer, 'ensureRetsDocumentImages')
        let buildRetsDocumentTransformedSpy = sandbox.spy(transformer, 'buildRetsDocumentTransformed')
        let transformRetsDocumentSpy = sandbox.spy(transformer, 'transformRetsDocument')
        let documentTransformerFactorySpy = sandbox.spy(transformer, 'documentTransformerFactory')
        return transformer.transformRetsDocumentExtracted(rde)
          .then(rdt => {
            expect(ensureRetsDocumentImagesSpy).to.have.been.calledWith(rde, rde.retsDocumentBody)
            expect(documentTransformerFactorySpy).to.have.been.calledWith(
              sinon.match.has('images', sinon.match.array)
            )
            expect(transformRetsDocumentSpy).to.have.been.calledWith(rde, sinon.match.instanceOf(DocumentTransformer))
            expect(buildRetsDocumentTransformedSpy).to.have.been.called
            expect(rdt).not.to.have.property('transformManifest')
            expect(rdt).not.to.have.property('retsDocumentBody')
            expect(rdt).to.have.property('transformedDocumentBody')
            expect(_.keysIn(rdt.transformedDocumentBody).length, 'transformedDocumentBody keys').to.be.at.least(randomCount)
            try {
              _.forEach(rde.transformManifest.listing, function (mapping) {
                expect(rdt.transformedDocumentBody).to.have.property(mapping.target[0])
                  .and.be.eq(rde.retsDocumentBody[mapping.source[0]].toLowerCase())
              })
            } catch (err) {
              console.log('rde.retsDocumentBody', rde.retsDocumentBody)
              console.log('rdt.transformedDocumentBody', rdt.transformedDocumentBody)
              console.log('rde.transformManifest.listing', rde.transformManifest.listing)
              throw err
            }
          })
      })
    }) // end transformRetsDocumentExtracted
    describe('transformRetsDocument', function () {
      it('should enrich and add the import_id, provider_id, purchase_types[]', function () {
        documentTransformer.hydrate.resolves(rde)
        return transformer.transformRetsDocument(rde, documentTransformer)
          .then(rdt => {
            expect(rdt).to.be.eq(rde)
            expect(documentTransformer.set).to.have.been.calledWith('import_id', rde.config.importId)
            expect(documentTransformer.set).to.have.been.calledWith('provider_id', rde.config.providerId)
            expect(documentTransformer.set).to.have.been.calledWith('purchase_types', sinon.match.array.and(
              sinon.match(function (value) {
                return value[0] === rde.purchaseType
              })))
          })
      })
    }) // end transformRetsDocumentExtracted
  }) // end methods
})// end firehoseTransformer
