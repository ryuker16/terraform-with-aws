/* eslint-env mocha */

'use strict'
require('reflect-metadata')
const ExtractProcessor = require('src/lib/processor').ExtractProcessor
const chai = require('chai')
const sinon = require('sinon')
chai.use(require('sinon-chai'))
const expect = chai.expect
const Promise = require('bluebird')
const _ = require('lodash')
const Faker = require('faker')

describe('ExtractProcessor', function () {
  var configStub = null
  beforeEach(() => {
    configStub = sinon.stub({
      get: _.noop,
      has: _.noop
    })
    configStub.has.withArgs('batchSize').returns(true)
    configStub.get.withArgs('batchSize').returns(Faker.random.number(10).toString())
    configStub.has.withArgs('sleepTimeMs').returns(true)
    configStub.get.withArgs('sleepTimeMs').returns(Faker.random.number(10, 100).toString())
  })
  it('should export class', function () {
    expect(ExtractProcessor).to.be.a('function')
  })
  describe('constructor', function () {
    it('should throw without config', function () {
      expect(() => {
        return new ExtractProcessor(configStub)
      }).to.throw(TypeError)
    })
    it('should throw without queueService', function () {
      expect(() => {
        return new ExtractProcessor(configStub, { consume: _.noop })
      }).to.throw(TypeError)
    })
    it('should throw without importerService', function () {
      expect(() => {
        return new ExtractProcessor(configStub, { consume: _.noop }, null)
      }).to.throw(TypeError)
    })
    it('should expose a consumeQueueForever function', function () {
      let p = new ExtractProcessor(configStub, { consume: _.noop }, { importListings: _.noop })
      expect(p.consumeQueueForever).to.be.a('function')
      expect(configStub.get).to.have.callCount(2)
    })
  })
  describe('methods', function () {
    var queue
    var logger
    var expectedError = null
    var expectedBreakingError = null
    var importer = null
    var exporter = null
    var notifier = null
    var exporterFactory = null
    var exportListingsStub = null
    var timestampNotifier = null
    var factory = _.noop
    beforeEach(() => {
      queue = sinon.stub({
        getMessage: () => { },
        consume: () => { }
      })
      importer = sinon.stub({
        importListings: _.noop
      })
      exporter = sinon.stub()
      // separate because exportListings is meld and wired
      exporter.exportListings = (exportListingsStub = sinon.stub())
      exporterFactory = sinon.stub().returns(exporter)
      notifier = sinon.stub({
        notifyImportedListings: _.noop
      })
      timestampNotifier = sinon.stub({
        processImport: _.noop
      })
      logger = sinon.stub({
        setContext: _.noop,
        boundary: _.noop,
        telemetry: _.noop,
        error: _.noop
      })
      expectedError = new Error(Date.now().toString())
      expectedBreakingError = new TypeError('break')
      factory = () => new ExtractProcessor(configStub, queue, importer, exporterFactory, notifier, timestampNotifier, logger)
    })
    describe('consumeQueueForever', function () {
      it('should start queue consume', function () {
        queue.consume.rejects(expectedBreakingError)
        return factory().consumeQueueForever()
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedBreakingError)
            expect(queue.consume).to.have.been.calledOnce
          })
      })
      it('should start queue consume with handleMessage fn and batchSize', function () {
        queue.consume = function (args) {
          expect(args.handleMessage).to.be.a('function')
          expect(args.batchSize).to.be.a('number')
          expect(args.batchSize).to.be.eq(parseInt(configStub.get('batchSize')))
          throw expectedBreakingError
        }
        return factory().consumeQueueForever()
          .then(expect.fail)
          .catch(err => {
            expect(logger.error).to.have.been.calledWith(expectedBreakingError)
            expect(err).to.be.eq(expectedBreakingError)
          })
      })
    })
    describe('consumeQueueForeverIterator', function () {
      it('should log any error then next on a non fatal error', function (done) {
        let processor = factory()
        sinon.stub(processor, 'consumeQueue')
          .rejects(expectedError)
        var next = (err) => Promise.try(() => {
          expect(logger.error).to.have.been.calledOnce
          expect(logger.error).to.have.been.calledWith(expectedError)
          expect(err).to.be.undefined
        }).asCallback(done)
        processor.consumeQueueForeverIterator(next)
      })
      it('should log any error then next break on a fatal error', function (done) {
        let processor = factory()
        sinon.stub(processor, 'consumeQueue')
          .rejects(expectedBreakingError)
        var next = (err) => Promise.try(() => {
          expect(err).to.be.eq(expectedBreakingError)
          expect(logger.error).to.have.been.calledWith(expectedBreakingError)
        }).asCallback(done)
        processor.consumeQueueForeverIterator(next)
      })
      it('should NOT log any error on resolve then next', function (done) {
        let processor = factory()
        sinon.stub(processor, 'consumeQueue')
          .resolves()
        var next = (err) => Promise.try(() => {
          expect(err).to.be.undefined
          expect(logger.error).not.to.have.been.called
        }).asCallback(done)
        processor.consumeQueueForeverIterator(next)
      })
    })
    describe('processMessage', function () {
      it('should early resolve [] if message is falsy', function () {
        var verify = function (msg) {
          return function (result) {
            expect(result).to.be.a('array')
            expect(result).to.have.lengthOf(0)
          }
        }
        return Promise.all([
          factory().processMessage().then(verify('empty')),
          factory().processMessage(null).then(verify('null')),
          factory().processMessage({ Data: null }).then(verify('Data: null'))
        ])
      })
      describe('when message.Data is ok', function () {
        it('should importListings with .config and .context', function () {
          let msg = {
            Data: {
              config: 'abc',
              context: 'xyz'
            }
          }
          importer.importListings.rejects(expectedError)
          return factory().processMessage(msg)
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              expect(importer.importListings).to.have.been.calledWith(msg.Data.config)
              expect(importer.importListings).to.have.been.calledWith(sinon.match.any, msg.Data.context)
            })
        })
      })
      describe('when importListings resolves', function () {
        it('should NOT notifyImportedListings with an empty importListingsResponse', function () {
          var msg = { Data: {} }
          importer.importListings.resolves(null)
          exportListingsStub.rejects(expectedError)
          return factory().processMessage(msg)
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              expect(notifier.notifyImportedListings).not.to.have.been.called
            })
        })
        it('should notifyImportedListings with an importListingsResponse', function () {
          var msg = { Data: {} }
          var importListingsResponse = { foo: 'bar' }
          importer.importListings.resolves(importListingsResponse)
          exportListingsStub.rejects(expectedError)
          return factory().processMessage(msg)
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              expect(notifier.notifyImportedListings).to.have.been.calledWith(importListingsResponse)
            })
        })
        it('should exportListings even if notifyImportedListings rejects', function () {
          var msg = { Data: {} }
          var importListingsResponse = { foo: 'bar' }
          notifier.notifyImportedListings.rejects(new Error('not expected'))
          importer.importListings.resolves(importListingsResponse)
          exportListingsStub.rejects(expectedError)
          return factory().processMessage(msg)
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              expect(exportListingsStub).to.have.been.calledWith(msg.Data, importListingsResponse)
            })
        })
      })
    })
  })
})
