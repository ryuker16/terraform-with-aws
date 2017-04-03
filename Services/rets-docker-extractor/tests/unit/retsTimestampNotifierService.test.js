/* eslint-env mocha */
'use strict'
require('reflect-metadata')
const chai = require('chai')
const assert = chai.assert
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
chai.use(chaiAsPromised)
const _ = require('lodash')
const Promise = require('bluebird')
const RetsTimestampNotifierService = require('src/lib/rets/retsTimestampNotifierService').RetsTimestampNotifierService
const Faker = require('faker')

describe('RetsTimestampNotifierService', function () {
  it('should export class', function () {
    expect(RetsTimestampNotifierService).to.be.a('function')
  })
  describe('constructor', function () {
    it('should use snsFactory as sns', function () {
      let retVal = { foo: Faker.random.uuid() }
      let instance = new RetsTimestampNotifierService(sinon.stub().returns(retVal))
      expect(instance.sns).to.be.eq(retVal)
    })
  })
  let subject = null
  let snsFactory = null
  let sns = null
  let logger = null
  beforeEach(function () {
    sns = sinon.stub({
      publish: _.noop
    })
    snsFactory = sinon.stub()
    snsFactory.returns(sns)
    logger = sinon.stub({
      audit: _.noop
    })
    subject = new RetsTimestampNotifierService(snsFactory, logger)
  })
  describe('methods', function () {
    describe('processImport', function () {
      it('should return a promise', function () {
        let createMsgStub = sinon.stub(subject, 'createRetsStatsAvailable')
        createMsgStub.resolves({})
        let extractRequest = { context: { correlationID: '' }, config: {} }
        let promise = subject.processImport(null, extractRequest)
        promise.catch(_.noop)
        expect(promise).to.be.instanceOf(Promise)
      })
    })
    describe('createRetsStatsAvailable', function () {
      it('should return the retsStatsAvailable object', function () {
        let importConfig = {}
        let context = { correlationID: 'id' }
        let importListingResponse = {}
        let createRetsQueryStub = sinon.stub(subject, 'createRetsQueryStats')
        createRetsQueryStub.returns([])
        let statsAvailable = subject.createRetsStatsAvailable(importConfig, importListingResponse, context)
        let expectedMsg = {
          protocol: 'RETS',
          context: context,
          retsQueryStats: [],
          config: {}
        }
        assert.deepEqual(statsAvailable, expectedMsg)
      })
    })
    describe('createRetsQueryStats', function () {
      let context = null
      let importListingResponse = null
      beforeEach(function () {
        context = {
          importId: Faker.random.uuid(),
          correlationID: Faker.random.uuid()
        }

        importListingResponse = {
          resources: [
            {
              classes: [
                // valid retsQueryStat
                {
                  resourceName: 'Property',
                  className: 'Residential',
                  classModel: {
                    retsQueryFields: {
                      lastModField: 'last_mod',
                      lastPhotoModField: 'photo_last_mod'
                    }
                  },
                  queryModel: {
                    queryType: 'last_mod'
                  },
                  results: [1, 2, 3]
                },
                // invalid retsQueryStat because of err
                {
                  resourceName: 'Property',
                  className: 'Commercial',
                  classModel: {
                    retsQueryFields: {
                      lastModField: 'last_mod',
                      lastPhotoModField: 'photo_last_mod'
                    }
                  },
                  queryModel: {
                    queryType: 'photo_last_mod'
                  },
                  results: [4, 5, 6],
                  err: 'This is an error'
                },
                // invalid retsQueryStat because of empty results
                {
                  resourceName: 'Property',
                  className: 'Condominium',
                  classModel: {
                    retsQueryFields: {
                      lastModField: 'last_mod',
                      lastPhotoModField: 'photo_last_mod'
                    }
                  },
                  queryModel: {
                    queryType: 'photo_last_mod'
                  },
                  results: []
                }]
            }]
        }
      })
      it('should return an empty array of rets query stats', function () {
        let importListingResponse = { resources: [] }
        let statsArray = subject.createRetsQueryStats(importListingResponse, context)
        expect(statsArray).to.be.an('array')
        expect(statsArray.length).to.be.equal(0)
      })
      it('should return an array of rets query stats', function () {
        let getTimestampStub = sinon.stub(subject, 'getMaxTimestamp')
        getTimestampStub.returns('2016-11-14')
        let statsArray = subject.createRetsQueryStats(importListingResponse, context)
        expect(statsArray).to.be.an('array')
        expect(statsArray.length).to.be.equal(1)
      })
      it('should filter out errored classResults', function () {
        let getTimestampStub = sinon.stub(subject, 'getMaxTimestamp')
        getTimestampStub.returns('2016-11-14')
        let statsArray = subject.createRetsQueryStats(importListingResponse, context)
        expect(statsArray.length).to.be.equal(1)
        expect(statsArray[0].className).to.be.eq('Residential')
      })
      it('should filter out classes without results', function () {
        let getTimestampStub = sinon.stub(subject, 'getMaxTimestamp')
        getTimestampStub.returns('2016-11-14')
        let statsArray = subject.createRetsQueryStats(importListingResponse, context)
        expect(statsArray.length).to.be.equal(1)
        expect(statsArray[0].className).to.be.eq('Residential')
      })
      it('should return previousRunTime if the retsQueryStat.lastRunTime was set', function () {
        let lastRunTime = Faker.date.recent().toString()
        let expectedResultCount = Faker.random.number({ min: 5, max: 10 })
        // add retsQueryStat lastRunTime to the valid classResponse
        importListingResponse.resources[0].classes[0].retsQueryStat = {
          lastRunTime
        }
        // add results and no lastRunTime to the empty
        importListingResponse.resources[0].classes[2].results = _.times(expectedResultCount, (n) => n)
        let statsArray = subject.createRetsQueryStats(importListingResponse, context)
        expect(statsArray).to.have.lengthOf(2)
        expect(statsArray[0].previousRunTime).to.be.eq(lastRunTime)
        expect(statsArray[1].resultCount).to.be.eq(expectedResultCount)
        expect(statsArray[1].previousRunTime).not.to.be.ok
      })
    })
    describe('getMaxTimestamp', function () {
      let fieldName = 'LIST_10'
      it('should return string of valid timestamp entries', function () {
        let results = [
          { 'LIST_10': '2016-09-10' },
          { 'LIST_10': '2016-10-10' },
          { 'LIST_10': 'March' }]
        let maxTimeString = subject.getMaxTimestamp(fieldName, results)
        expect(maxTimeString).to.be.equal('2016-10-10')
        expect(logger.audit).to.have.been.called
      })
      it('should return empty string empty array', function () {
        let results = []
        let maxTimeString = subject.getMaxTimestamp(fieldName, results)
        expect(maxTimeString).to.be.equal('')
      })
      it('should return max timestamp', function () {
        let results = [
          { LIST_10: '2016-11-11' },
          { LIST_10: '2016-11-10' },
          { LIST_10: '2016-11-12 00:01:01.000' }]
        let maxTimeString = subject.getMaxTimestamp(fieldName, results)
        expect(maxTimeString).to.be.equal('2016-11-12 00:01:01.000')
      })
    })
    describe('publishRetsStatsAvailable', function () {
      it('should send retsStatsAvailable as Message body to SNS', function () {
        let expectedError = new Error('asdf')
        sns.publish.returns({ promise: sinon.stub().rejects(expectedError) })
        let retsStatsAvailable = { foo: 'bar' }
        return subject.publishRetsStatsAvailable(retsStatsAvailable)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(sns.publish).to.have.been.calledWith(sinon.match.has('Message', JSON.stringify(retsStatsAvailable)))
          })
      })
      it('should audit the RetsStatsAvailable with context', function () {
        let expectedError = new Error('asdf')
        sns.publish.returns({ promise: sinon.stub().rejects(expectedError) })
        let retsStatsAvailable = { context: { importId: Faker.random.uuid() } }
        return subject.publishRetsStatsAvailable(retsStatsAvailable)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(logger.audit).to.have.been.calledWith(
              'RetsTimestampNotifierService.publishRetsStatsAvailable',
              'info',
              sinon.match.has('importId', retsStatsAvailable.context.importId)
                .and(sinon.match.has('retsQueryStats'))
                .and(sinon.match.has('retsQueryStatsCount', 0))
            )
          })
      })
    })
  })
})
