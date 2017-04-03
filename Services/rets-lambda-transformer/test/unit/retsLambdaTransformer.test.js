'use strict'
/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.should()
chai.use(sinonChai)
const Faker = require('faker')
const testMappings = require('../data/test_mappings.json')

import { RetsLambdaTransformer } from 'lib/retsLambdaTransformer'
import { DocumentTransformer } from 'lib/documentTransformer'

describe('RetsLambdaTransformer', function () {
  describe('methods', function () {
    let sqsClient = null
    let repo = null
    let publisher = null
    let lambdaClient = null
    let logger = null
    let lambdaContext = null
    let subject = null
    let expectedError = null
    let factory = null
    let transformer = null
    let data = {
      Data: {
        Message: JSON.stringify({
          retsDocumentLocation: {
            bucket: Faker.name.firstName(),
            key: Faker.random.uuid()
          },
          retsDocumentMetadata: {
            resoType: 'property',
            resourceName: 'string',
            period: 'string',
            query: 'string',
            className: 'string',
            importId: 'string',
            purchaseType: 'res_sale',
            providerId: 'string',
            correlationID: 'string',
            scheduleId: 'string'
          }
        })
      }
    }
    beforeEach(function () {
      const fn = () => true
      sqsClient = sinon.stub({ getMessage: fn, deleteMessage: fn })
      repo = sinon.stub({ getExtractedDocument: fn, storeTransformedDocument: fn })
      lambdaContext = sinon.stub({ functionName: '' })
      publisher = sinon.stub({ publish: fn })
      logger = sinon.stub({ setContext: fn, error: fn })
      lambdaClient = sinon.stub({ invoke: fn })
      factory = sinon.stub()
      transformer = sinon.stub({ transform: fn, enrich: fn, hydrate: fn, set: fn })
      factory.returns(transformer)
      subject = new RetsLambdaTransformer(sqsClient, repo, publisher, lambdaClient, logger, lambdaContext, factory)
      expectedError = new Error('abc')
    })
    describe('constructor', function () {
      it('should provide a default factory for transformer', function () {
        let defaultSubject = new RetsLambdaTransformer(sqsClient, repo, publisher, lambdaClient, logger, lambdaContext)
        expect(defaultSubject.documentTransformerFactory).to.be.a.function
        let docTransformer = defaultSubject.documentTransformerFactory('')
        expect(docTransformer).to.be.instanceof(DocumentTransformer)
      })
    })
    describe('run', function () {
      it('should call sqsClient.getMessage', function () {
        sqsClient.getMessage.rejects(expectedError)
        return subject.run()
          .then(expect.fail)
          .catch(err => {
            expect(sqsClient.getMessage).to.have.been.called
            expect(err).to.be.eq(expectedError)
          })
      })
      it('should not process message if null', function () {
        let processStub = sinon.stub(subject, 'processRetsDocumentExtracted')
        processStub.resolves(true)
        sqsClient.getMessage.resolves(null)
        return subject.run()
          .then(() => {
            expect(sqsClient.getMessage).to.have.been.called
            expect(processStub).to.not.have.been.called
          })
      })
      it('should call sqsClient.deleteMessage', function () {
        let processStub = sinon.stub(subject, 'processRetsDocumentExtracted')
        processStub.resolves(true)
        sqsClient.getMessage.resolves(data)
        sqsClient.deleteMessage.rejects(expectedError)
        return subject.run()
        .then(expect.fail)
        .catch(err => {
          expect(sqsClient.deleteMessage).to.have.been.called
          expect(processStub).to.have.been.calledWith(
            sinon.match.has('retsDocumentLocation')
          )
          expect(err).to.be.equal(expectedError)
        })
      })
      it('should not call self invoke if no message in queue', function () {
        let processStub = sinon.stub(subject, 'processRetsDocumentExtracted')
        processStub.resolves(true)
        let invokeStub = sinon.stub(subject, 'selfInvokeAsync')
        invokeStub.rejects(expectedError)
        sqsClient.getMessage.onCall(0).resolves(data)
        sqsClient.deleteMessage.resolves(true)
        sqsClient.getMessage.onCall(1).rejects(expectedError)
        return subject.run()
        .then(expect.fail)
        .catch((err) => {
          expect(sqsClient.deleteMessage).to.have.been.called
          expect(sqsClient.getMessage).to.have.been.called
          expect(processStub).to.have.been.calledWith(
            sinon.match.has('retsDocumentLocation')
          )
          expect(invokeStub).to.not.have.been.called
          expect(err).to.be.equal(expectedError)
        })
      })
      it('should call self invoke if message in queue', function () {
        let processStub = sinon.stub(subject, 'processRetsDocumentExtracted')
        processStub.resolves(true)
        sqsClient.getMessage.onCall(0).resolves(data)
        sqsClient.deleteMessage.resolves(true)
        sqsClient.getMessage.onCall(1).resolves(true)
        let invokeStub = sinon.stub(subject, 'selfInvokeAsync')
        invokeStub.rejects(expectedError)
        return subject.run()
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(invokeStub).to.have.been.called
        })
      })
    })
    describe('processRetsDocumentExtracted', function () {
      let rde = null
      let rdt = null
      beforeEach(function () {
        rde = {
          retsDocumentLocation: {
            bucket: Faker.name.firstName(),
            key: Faker.random.uuid()
          },
          config: {
            importId: 'id',
            providerId: 'id'
          },
          retsDocumentMetadata: {
            resoType: 'property',
            resourceName: 'string',
            period: 'string',
            query: 'string',
            className: 'string',
            importId: 'string',
            purchaseType: 'res_sale',
            providerId: 'string',
            correlationID: 'string',
            scheduleId: 'string'
          },
          transformManifest: {
            listing: testMappings
          }
        }

        rdt = {
          transformedDocumentLocation: {
            bucket: Faker.name.firstName(),
            key: Faker.random.uuid()
          },
          config: {
            importId: 'id',
            providerId: 'id'
          },
          retsDocumentMetadata: {
            resoType: 'property',
            resourceName: 'string',
            period: 'string',
            query: 'string',
            className: 'string',
            importId: 'string',
            purchaseType: 'res_sale',
            providerId: 'string',
            correlationID: 'string',
            scheduleId: 'string'
          }
        }
      })
      it('should call repo.getExtractedDocument when retsDocumentBody is falsy', function () {
        repo.getExtractedDocument.rejects(expectedError)
        let rde = {
          retsDocumentLocation: {
            bucket: Faker.name.firstName(),
            key: Faker.random.uuid()
          }
        }
        return subject.processRetsDocumentExtracted(rde)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(repo.getExtractedDocument).to.have.been.calledWith(
              rde.retsDocumentLocation.bucket,
              rde.retsDocumentLocation.key
            )
          })
      })
      it('should call transform on a document without retsDocumentBody', function () {
        repo.getExtractedDocument.resolves(rdt)
        transformer.transform.rejects(expectedError)
        return subject.processRetsDocumentExtracted(rde)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(factory).to.have.been.calledWith(
            rdt
          )
        })
      })
      it('should call transform on a document', function () {
        rde.retsDocumentBody = {}
        rde.retsDocumentImages = []
        transformer.transform.rejects(expectedError)
        return subject.processRetsDocumentExtracted(rde)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(factory).to.have.been.calledWith(
            { images: [] }
          )
        })
      })
      it('should call transform, set, and enrich on document', function () {
        repo.getExtractedDocument.resolves(rdt)
        transformer.transform.resolves(transformer)
        transformer.set.resolves(true)
        transformer.enrich.rejects(expectedError)
        return subject.processRetsDocumentExtracted(rde)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(transformer.set).to.have.been.called
          expect(transformer.enrich).to.have.been.called
        })
      })
      it('should call transform, enrich, and hydrate on document', function () {
        repo.getExtractedDocument.resolves(rdt)
        transformer.transform.resolves(transformer)
        transformer.set.resolves(true)
        transformer.enrich.resolves(transformer)
        transformer.hydrate.rejects(expectedError)
        return subject.processRetsDocumentExtracted(rde)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(transformer.enrich).to.have.been.called
          expect(transformer.hydrate).to.have.been.called
        })
      })
      it('should store the transformed document', function () {
        repo.getExtractedDocument.resolves(rdt)
        transformer.transform.resolves(transformer)
        transformer.set.resolves(true)
        transformer.enrich.resolves(transformer)
        transformer.hydrate.resolves(transformer)
        repo.storeTransformedDocument.rejects(expectedError)
        return subject.processRetsDocumentExtracted(rde)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(transformer.enrich).to.have.been.called
          expect(transformer.hydrate).to.have.been.called
          expect(repo.storeTransformedDocument).to.have.been.called
        })
      })
      it('should set the document location and publish', function () {
        repo.getExtractedDocument.resolves(rdt)
        transformer.transform.resolves(transformer)
        transformer.set.resolves(true)
        transformer.enrich.resolves(transformer)
        transformer.hydrate.resolves(transformer)
        repo.storeTransformedDocument.resolves(rdt)
        publisher.publish.rejects(expectedError)
        return subject.processRetsDocumentExtracted(rde)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.equal(expectedError)
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(transformer.enrich).to.have.been.called
          expect(transformer.hydrate).to.have.been.called
          expect(repo.storeTransformedDocument).to.have.been.called
          expect(publisher.publish).to.have.been.called
        })
      })
      it('publishes successfully', function () {
        repo.getExtractedDocument.resolves(rdt)
        transformer.transform.resolves(transformer)
        transformer.set.resolves(true)
        transformer.enrich.resolves(transformer)
        transformer.hydrate.resolves(transformer)
        repo.storeTransformedDocument.resolves(rdt)
        publisher.publish.resolves(true)
        return subject.processRetsDocumentExtracted(rde)
        .then(result => {
          expect(transformer.transform).to.have.been.calledWith(
            testMappings
          )
          expect(transformer.enrich).to.have.been.called
          expect(transformer.hydrate).to.have.been.called
          expect(repo.storeTransformedDocument).to.have.been.called
          expect(publisher.publish).to.have.been.called
        })
      })
    })
  })
})
