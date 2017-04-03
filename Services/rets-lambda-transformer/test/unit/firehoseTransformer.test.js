'use strict'
/* eslint-env mocha */
import { FirehoseTransformer, FirehoseTransformerFactory, MAX_CONCURRENT } from 'lib/firehoseTransformer'
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
const Faker = require('faker')
const _ = require('lodash')

describe('FirehoseTransformer', function (done) {
  describe('constructor', function () {
    it('should throw without transformation function', function () {
      expect(() => {
        return new FirehoseTransformer('abc')
      }).to.throw
      expect(() => {
        return FirehoseTransformerFactory('abc')
      }).to.throw
    })
    it('should not throw with transformation function', function () {
      expect(() => {
        return new FirehoseTransformer(_.noop)
      }).not.to.throw
      expect(() => {
        return FirehoseTransformerFactory(_.noop)
      }).not.to.throw
    })
    it('should set the maxConcurrent', function () {
      let rand = Faker.random.number(300)
      let transformer = new FirehoseTransformer(_.noop, rand)
      expect(transformer.maxConcurrent).to.be.eq(rand)
    })
    it('should default the MAX_CONCURRENT', function () {
      let transformer = new FirehoseTransformer(_.noop)
      expect(transformer.maxConcurrent).to.be.eq(MAX_CONCURRENT)
    })
  })// end constructor

  describe('methods', function () {
    let transformationStub = null
    let records = []
    let sandbox = null
    let transformer = null
    let expectedError = null
    let randomCount = null
    beforeEach(function () {
      sandbox = sinon.sandbox.create()
      transformationStub = sandbox.stub()
      randomCount = Faker.random.number({ min: 5, max: 20 })
      transformer = new FirehoseTransformer(transformationStub)
      expectedError = new Error(`Fake error ${Faker.random.uuid()}`)
    })
    afterEach(function () {
      sandbox.restore()
    })

    describe('#processFirehoseRecords(Contracts.FirehoseRecords)', function () {
      let processFirehoseRecordStub = null
      beforeEach(function () {
        processFirehoseRecordStub = sandbox.stub(transformer, 'processFirehoseRecord')
        records = _.times(randomCount, (index) => {
          processFirehoseRecordStub.onCall(index).rejects(expectedError)
          return { index }
        })
      })
      it('should map against processFirehoseRecord and return first error even if processFirehoseRecord bombs', function () {
        transformer.maxConcurrent = Math.floor(randomCount * 2)
        return transformer.processFirehoseRecords({ records })
          .then(expect.fail)
          .error(err => {
            // OperationalError
            expect(err.cause).to.be.eq(expectedError)
            expect(processFirehoseRecordStub).to.have.callCount(randomCount)
          })
      })
      it('should map against processFirehoseRecord and only call maxConcurrent at the same time', function () {
        transformer.maxConcurrent = Math.floor(randomCount / 2)
        return transformer.processFirehoseRecords({ records })
          .then(expect.fail)
          .error(err => {
            // OperationalError
            expect(err.cause).to.be.eq(expectedError)
            expect(processFirehoseRecordStub).to.have.callCount(transformer.maxConcurrent)
          })
      })
      it('should map against processFirehoseRecord and only only on each success', function () {
        transformer.maxConcurrent = Math.floor(randomCount / 2)
        records = _.times(randomCount, (index) => {
          processFirehoseRecordStub.onCall(index).resolves({ result: 'Ok', data: index })
          return { index }
        })
        return transformer.processFirehoseRecords({ records })
          .then(result => {
            expect(result.records).to.be.a('array')
            expect(result.records).to.have.lengthOf(randomCount)
            _.forEach(result.records, (record, i) => {
              expect(record.result).to.be.eq('Ok')
              expect(record.data).to.be.eq(i)
            })
          })
      })
    })// end processFirehoseRecords
    describe('processFirehoseRecord', function () {
      let resultRecord = {}
      let expectedDataBuffer = ''
      let expectedErrorBuffer = ''
      let inputRecord = {}
      let inputRecordData = {}
      beforeEach(function () {
        inputRecordData = {
          property: Faker.random.uuid()
        }
        inputRecord = {
          recordId: Faker.random.uuid(),
          data: new Buffer(JSON.stringify(inputRecordData)).toString('base64')
        }
        resultRecord = {
          data: {
            property: Faker.random.uuid()
          }
        }
        expectedDataBuffer = new Buffer(JSON.stringify(resultRecord.data)).toString('base64')
        expectedErrorBuffer = new Buffer(JSON.stringify(expectedError)).toString('base64')
      })
      it('should call the transformation against the record data with decoded base64 of the { data }', function () {
        transformer = new FirehoseTransformer(transformationStub)
        return transformer.processFirehoseRecord(inputRecord)
          .then(processedRecord => {
            expect(processedRecord.result).to.be.eq('ProcessingFailed')
            expect(transformationStub.getCall(0).args[0]).to.be.deep.eq(inputRecordData)
          })
      })
      it('should call the transformation against and set data buffer to error and ProcessingFailed', function () {
        transformationStub.resolves({ err: expectedError })
        return transformer.processFirehoseRecord(inputRecord)
          .then(processedRecord => {
            expect(processedRecord.data).to.be.eq(expectedErrorBuffer)
            expect(processedRecord.result).to.be.eq('ProcessingFailed')
          })
      })
      it('should catch the transformation against and set data buffer to error and ProcessingFailed', function () {
        transformationStub.rejects(expectedError)
        return transformer.processFirehoseRecord(inputRecord)
          .then(processedRecord => {
            expect(processedRecord.data).to.be.eq(expectedErrorBuffer)
            expect(processedRecord.result).to.be.eq('ProcessingFailed')
          })
      })
      it('should set Dropped if the transformation returns { drop: true }', function () {
        transformationStub.resolves({ drop: true })
        return transformer.processFirehoseRecord(inputRecord)
          .then(processedRecord => {
            expect(processedRecord.result).to.be.eq('Dropped')
          })
      })
      it('should set Ok if the transformation returns { data }', function () {
        transformationStub.resolves(resultRecord)
        return transformer.processFirehoseRecord(inputRecord)
          .then(processedRecord => {
            expect(processedRecord.result).to.be.eq('Ok')
            expect(processedRecord.data).to.be.eq(expectedDataBuffer)
          })
      })
    })
  }) // end methods
})// end firehoseTransformer
