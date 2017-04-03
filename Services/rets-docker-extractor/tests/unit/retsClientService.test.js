/* eslint-env mocha */
'use strict'
require('reflect-metadata')
const chai = require('chai')
// const sinon = require('sinon')
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
chai.use(chaiAsPromised)
const shortid = require('shortid')
const _ = require('lodash')
const Promise = require('bluebird')
const rets = require('rets-client')
const RetsClientService = require('src/lib/rets/retsClientService').RetsClientService
const RetsErrorCodes = require('src/lib/rets/interfaces').RetsErrorCodes
const Faker = require('faker')

describe('RetsClientService', function () {
  it('should export class', function () {
    expect(RetsClientService).to.be.a('function')
  })
  describe('rets-client', function () {
    it('should export type RetsError', function () {
      expect(rets.RetsError).to.be.a('function')
    })
    it('should export type RetsError instance of Error', function () {
      expect(new rets.RetsError()).to.be.an.instanceOf(Error)
      expect(rets.RetsError.prototype).to.be.an.instanceOf(Error)
    })
    it('should export type RetsReplyError', function () {
      expect(rets.RetsReplyError).to.be.a('function')
      expect(new rets.RetsReplyError({})).to.be.an.instanceOf(rets.RetsError)
    })
  })
  describe('enum RetsErrorCodes', function () {
    it('NO_RECORDS_FOUND=20201', () => {
      expect(RetsErrorCodes.NO_RECORDS_FOUND).to.be.equal(20201)
    })
  })
  describe('methods', function () {
    let retsStub = null
    let service = null
    let logger = null
    let clientStub = null
    let expectedError = null
    let resourceName = ''
    let className = ''
    let query = ''
    beforeEach(function () {
      expectedError = new Error(Date.now().toString())
      retsStub = sinon.stub({
        getAutoLogoutClient: _.noop
      })
      logger = sinon.stub({
        audit: _.noop,
        error: _.noop,
        boundary: _.noop,
        telemetry: _.noop
      })
      clientStub = {
        search: {
          query: sinon.stub()
        },
        objects: {
          getAllObjects: sinon.stub()
        }
      }
      service = new RetsClientService(retsStub, logger)
      resourceName = Faker.name.firstName()
      className = Faker.name.lastName()
      query = Faker.random.uuid()
    })
    describe('getClient', function () {
      it('should call getAutoLogoutClient with clientSettings', function () {
        retsStub.getAutoLogoutClient.rejects()
        let clientSettings = { username: shortid.generate() }
        return service.getClient(clientSettings)
          .catch(() => {
            expect(retsStub.getAutoLogoutClient).to.have.been.calledWith(sinon.match(clientSettings))
          })
      })
      it('should reject if getAutoLogoutClient rejects', function () {
        let expectedError = new Error(shortid.generate())
        retsStub.getAutoLogoutClient.rejects(expectedError)
        return service.getClient({})
          .catch((err) => {
            expect(err).to.be.equal(expectedError)
          })
      })
      it('should always return a promise to the getAutoLogoutClient callback', function (done) {
        retsStub.getAutoLogoutClient = function (settings, cb) {
          let promise = cb()
          expect(promise.then).to.be.a('function')
          done()
          return Promise.resolve()
        }
        let clientSettings = { username: shortid.generate() }
        service.getClient(clientSettings, () => true)
      })
      it('should catch and reject if the callback promise to the getAutoLogoutClient callback', function (done) {
        var check = function (promise, err) {
          console.log('IN THE CURRY')
          expect(err).to.be.equal(expectedError)
          expect(promise.then).to.be.a('function')
          expect(promise.isRejected()).to.be.equal(true)
          done()
        }
        var curried = _.curry(check)
        let expectedError = new Error(shortid.generate())
        retsStub.getAutoLogoutClient = function (settings, cb) {
          let promise = cb()
          console.log('PROMISE', promise)
          curried = curried(promise)
          return Promise.delay(10)
        }
        service.getClient({}, () => {
          throw expectedError
        }).catch(err => {
          console.log('CATCH', err)
          curried = curried(err)
        })
      })
    })
    describe('loadListings', function () {
      let recurseQuery = null
      beforeEach(function () {
        recurseQuery = sinon.stub(service, 'recurseQuery')
      })
      it('should build requestContext to recurseQuery', function () {
        let queryOptions = {}
        recurseQuery.rejects(expectedError)
        return service.loadListings(clientStub, resourceName, className, query, queryOptions)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(recurseQuery).to.have.been.calledWith(clientStub)
            expect(recurseQuery).to.have.been.calledWith(
              clientStub,
              sinon.match.has('className', className)
                .and(sinon.match.has('resourceName', resourceName))
                .and(sinon.match.has('query', query))
                .and(sinon.match.has('queryOptions', queryOptions))
                .and(sinon.match.has('results', sinon.match.array))
                .and(sinon.match.has('responses', sinon.match.array))
            )
          })
      })
      it('should log recurseQuery errors', function () {
        let options = {}
        recurseQuery.rejects(expectedError)
        return service.loadListings(clientStub, resourceName, className, query, options)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(logger.error).to.have.been.calledWith(expectedError)
          })
      })
    })
    describe('retsQuery', function () {
      it('should client.search.query', function () {
        let queryOptions = { foo: 'bar' }
        clientStub.search.query.rejects(expectedError)
        return service.retsQuery(clientStub, {
          resourceName,
          className,
          query,
          queryOptions,
          requests: []
        }).then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(clientStub.search.query).to.have.been.calledWith(
              resourceName,
              className,
              query,
              queryOptions
            )
          })
      })
      it('should append to requests[] ', function () {
        let queryOptions = { foo: 'bar' }
        clientStub.search.query.rejects(expectedError)
        let requestContext = {
          resourceName,
          className,
          query,
          queryOptions,
          requests: []
        }
        return service.retsQuery(clientStub, requestContext)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(clientStub.search.query).to.have.been.called
            expect(requestContext.requests).to.have.lengthOf(1)
          })
      })
    })
    describe('recurseQuery', function () {
      let retsQuery = null

      let requestContext = null
      let processResponse = null
      beforeEach(function () {
        retsQuery = sinon.stub(service, 'retsQuery')
        processResponse = sinon.stub(service, 'processResponse')
        requestContext = {
          resourceName,
          className,
          query,
          results: [],
          responses: [],
          breakFlag: false
        }
      })
      it('should resolve requestContext if breakFlag', function () {
        requestContext.breakFlag = true
        return service.recurseQuery(clientStub, requestContext)
          .then(result => {
            expect(result).to.be.eq(requestContext)
          })
      })
      it('should initiate a retsQuery if not breakFlag and rethrow', function () {
        retsQuery.rejects(expectedError)
        return service.recurseQuery(clientStub, requestContext)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(retsQuery.firstCall.thisValue, 'this service').to.be.eq(service)
          })
      })
      it('should processResponse after retsQuery resolves', function () {
        var retsResponse = { foo: 'bar' }
        retsQuery.resolves(retsResponse)
        processResponse.rejects(expectedError)
        return service.recurseQuery(clientStub, requestContext)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(processResponse, 'calledWith requestContest').to.have.been.calledWith(
              requestContext,
              retsResponse)
          })
      })
      it('should recurseQuery after processResponse resolves and break on breakFlag', function () {
        var retsResponse = { foo: 'bar' }
        retsQuery.resolves(retsResponse)
        service.processResponse = function (rq) {
          expect(rq).to.be.eq(requestContext)
          // signals to next recurseQuery to break
          rq.breakFlag = true
        }
        processResponse = sinon.spy(service, 'processResponse')
        return service.recurseQuery(clientStub, requestContext)
          .then(result => {
            expect(retsQuery).to.have.been.calledOne
            expect(processResponse).to.have.been.calledOnce
            expect(result.breakFlag).to.be.ok
          })
      })
    })
    describe('processResponse', function () {
      let resourceName = ''
      let className = ''
      let query = ''
      let requestContext = null
      let queryResponse = null
      beforeEach(function () {
        resourceName = Faker.name.firstName()
        className = Faker.name.lastName()
        query = Faker.random.uuid()
        requestContext = {
          resourceName,
          className,
          query,
          results: [],
          responses: [],
          breakFlag: false
        }
        queryResponse = {
          rowsReceived: Faker.random.number(10),
          results: []
        }
      })
      it('should breakFlag if queryResponse is empty', function () {
        service.processResponse(requestContext)
        expect(requestContext.breakFlag).to.be.ok
      })
      it('should audit the queryResponse sans results[] and break without results', function () {
        service.processResponse(requestContext, queryResponse)
        expect(requestContext.breakFlag, 'break w/o results').to.be.ok
        expect(logger.audit).not.to.have.been.calledWith(
          sinon.match.any,
          sinon.match.any,
          sinon.match.has('retsResponse', sinon.match.has('results'))
        )
        expect(logger.audit).to.have.been.calledWith(
          sinon.match.string,
          'info',
          sinon.match.has('retsResponse', sinon.match.has('rowsReceived'))
        )
      })
      it('should append results and inc offset by result length', function () {
        requestContext.queryOptions = {
          limit: Faker.random.number(1000),
          offset: 5
        }
        queryResponse.results = _.times(Faker.random.number(10), _.toString)
        service.processResponse(requestContext, queryResponse)
        expect(requestContext.results).to.have.lengthOf(queryResponse.results.length)
        expect(requestContext.queryOptions.offset).to.be.eq(5 + queryResponse.results.length)
      })
      describe('when results are returned', function () {
        beforeEach(function () {
          // append positive results
          queryResponse.results = _.times(Faker.random.number(10, 20), _.toString)
        })

        it('should breakFlag if options.offsetNotSupported', function () {
          requestContext.queryOptions = {
            limit: 1000,
            offset: 1,
            offsetNotSupported: null
          }
          service.processResponse(requestContext, queryResponse)
          expect(requestContext.breakFlag).to.be.ok
        })
        it('should breakFlag if options.offset nil', function () {
          requestContext.queryOptions = {
            limit: 1000,
            offset: null
          }
          service.processResponse(requestContext, queryResponse)
          expect(requestContext.breakFlag).to.be.ok
        })
        it('should breakFlag if results >= options.limit', function () {
          requestContext.queryOptions = {
            limit: Faker.random.number(5, 10)
          }
          service.processResponse(requestContext, queryResponse)
          expect(requestContext.breakFlag).to.be.ok
        })
        it('should breakFlag if responses >= options.limitCalls', function () {
          requestContext.queryOptions = {
            limit: Faker.random.number(5, 10),
            limitCalls: 1,
            offset: 1
          }
          service.processResponse(requestContext, queryResponse)
          expect(requestContext.breakFlag).to.be.ok
        })
      })
    })
    describe('importImages', function () {
      it('should return empty array of image objects', function () {
        clientStub.objects.getAllObjects.resolves({ objects: [] })
        return service.importImages(clientStub, 'property', '0', 'Photo')
          .then(results => {
            expect(results.length).to.be.equal(0)
          })
      })
      it('should return array of image objects', function () {
        let objects = [{}, { objectId: 'id', location: 'some url' }, {}]
        clientStub.objects.getAllObjects.resolves({ objects })
        return service.importImages(clientStub, 'property', '0', 'Photo')
          .then(results => {
            expect(results.length).to.be.equal(objects.length)
            expect(results[0]).to.be.equal(objects[0])
            expect(results[1]).to.be.deep.equal({ objectId: 'id', location: 'some url' })
            expect(results[2]).to.be.equal(objects[2])
          })
      })
      it('should preserve errors received', function () {
        let objects = [{ err: 'Image not found' }, { objectId: 'id', location: 'some url' }]
        clientStub.objects.getAllObjects.resolves({ objects })
        return service.importImages(clientStub, 'property', '0', 'Photo')
          .then(results => {
            expect(results.length).to.be.equal(2)
            expect(results[0]).to.be.deep.equal(objects[0])
            expect(results[1]).to.be.deep.equal(objects[1])
          })
      })
    })
  })
})
