/// <reference types="sinon-chai" />
/// <reference types="sinon-as-promised" />
/// <reference types="mocha" />

import { Contracts, UtcDateString, Models, Rets } from 'etl'
import { ImportRepository } from '../../../src/lib/importRepository'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
chai.use(sinonChai)
import * as Faker from 'faker'
import * as _ from 'lodash'
import * as Promise from 'bluebird'
import { ObjectID } from 'mongodb'

describe('ImportRepository', function () {
  it('should export updateRetsQueryStats, updateRetsQueryStatsBatch', function () {
    expect(ImportRepository.prototype.updateRetsQueryStats).to.be.a('function')
    expect(ImportRepository.prototype.updateRetsQueryStatsBatch).to.be.a('function')
    expect(ImportRepository.prototype.updateOne).to.be.a('function')
  })
  describe('methods', function () {
    let subject: ImportRepository = null
    let logger: any = null
    let db: any = null
    let retsStatsAvailable: Contracts.RetsStatsAvailable = null
    let docs: any[] = null
    let nDocs = 0
    let expectedError = new Error('')
    let updateOneStub = sinon.stub()
    let updateOneBatchStub = sinon.stub()
    let resourceName: string = ''
    let className: string = ''
    beforeEach(function () {
      logger = sinon.stub({
        audit: _.noop
      })
      db = sinon.stub()
      nDocs = Faker.random.number(5)
      docs = []
      expectedError = new Error(Faker.address.streetName())
      subject = new ImportRepository(logger)
      updateOneStub = sinon.stub(subject, 'updateOne')
      updateOneBatchStub = sinon.stub(subject, 'updateOneBatch')
      resourceName = Faker.name.firstName()
      className = Faker.name.lastName()
      retsStatsAvailable = {
        context: {
          protocol: 'RETS',
          period: Faker.date.weekday(),
          startTime: Faker.date.past().toString() as UtcDateString,
          importId: new ObjectID().toString(),
          correlationID: Faker.random.uuid(),
          scheduleId: Faker.random.uuid()
        },
        protocol: 'RETS',
        retsQueryStats: []
      }
      retsStatsAvailable.retsQueryStats.push({
        resourceName, className
      } as Models.RetsQueryStats)
    })
    describe('updateRetsQueryStats', function () {
      it('should return a promise', function () {
        let p = subject.updateRetsQueryStats(null, db)
        expect(p.then).to.be.a('function')
        return p.catch(_.noop)
      })
      it('should call updateOne with retsStatsAvailableList and updateOperation', function () {
        updateOneStub.rejects(expectedError)
        return subject.updateRetsQueryStats(retsStatsAvailable, db)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(updateOneStub).to.have.been.calledWith(retsStatsAvailable)
            expect(updateOneStub).to.have.been.calledWith(
              sinon.match.any,
              sinon.match.has('collectionName')
                .and(sinon.match.has('getFilter'))
                .and(sinon.match.has('getUpdate')))
          })
      })
      it('should call updateOne with getFilter by _id: context.importId', function () {
        subject.updateOne = function (item: any, updateOperation: any) {
          return Promise.try<any>(() => {
            expect(updateOperation.getFilter(item))
              .to.have.property('_id')
              .that.is.an.instanceOf(ObjectID)
            expect(updateOperation.getFilter(item)._id.toString())
              .to.be.eq(retsStatsAvailable.context.importId)
          }).thenReturn({ modifiedCount: 1 })
        }
        return subject.updateRetsQueryStats(retsStatsAvailable, db)
      })
      it('should call updateOne with getUpdate by $set: ETLServiceConfig.retsQueryStats.resourceNameclassName', function () {
        subject.updateOne = function (item: any, updateOperation: any) {
          return Promise.try<any>(() => {
            expect(updateOperation.getUpdate(item))
              .to.have.property('$set')
              .to.have.property(`ETLServiceConfig.retsQueryStats.${resourceName}${className}`)
              .to.be.deep.eq(retsStatsAvailable.retsQueryStats[0])
          }).thenReturn({ modifiedCount: 1 })
        }
        return subject.updateRetsQueryStats(retsStatsAvailable, db)
      })
    })
    describe('updateRetsQueryStatsBatch', function () {
      it('should return a promise', function () {
        let p = subject.updateRetsQueryStatsBatch(docs, db)
        expect(p.then).to.be.a('function')
        return p.catch(_.noop)
      })
      it('should call updateOneBatch with retsStatsAvailableList and updateOperation', function () {
        updateOneBatchStub.rejects(expectedError)
        return subject.updateRetsQueryStatsBatch(docs, db)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
            expect(updateOneBatchStub).to.have.been.calledWith(docs)
            expect(updateOneBatchStub).to.have.been.calledWith(
              sinon.match.any,
              sinon.match.has('collectionName')
                .and(sinon.match.has('getFilter'))
                .and(sinon.match.has('getUpdate')))
          })
      })
      it('should call updateOneBatch with getFilter by _id: context.importId', function () {
        let importDoc = {
          context: {
            importId: new ObjectID().toString()
          }
        }
        docs.push(importDoc)
        subject.updateOneBatch = function (items: any[], updateOperation: any) {
          return Promise.try<any>(function () {
            expect(updateOperation.getFilter(items[0]))
              .to.have.property('_id')
              .that.is.an.instanceOf(ObjectID)
            expect(updateOperation.getFilter(items[0])._id.toString())
              .to.be.eq(importDoc.context.importId)
          }).thenReturn({ modifiedCount: 1 })
        }
        return subject.updateRetsQueryStatsBatch(docs, db)
      })
      it('should call updateOneBatch with getUpdate by $set: ETLServiceConfig.retsQueryStats', function () {
        let item1 = {
          retsQueryStats: [{
            resourceName, className
          }]
        }
        let setKey = `ETLServiceConfig.retsQueryStats.${resourceName}${className}`
        docs.push(item1)
        subject.updateOneBatch = function (items: any[], updateOperation: any) {
          expect(updateOperation.getUpdate(items[0]))
            .to.have.property('$set')
            .to.have.property(setKey)
            .to.be.deep.eq(item1.retsQueryStats[0])
          return Promise.reject(expectedError)
        }
        return subject.updateRetsQueryStatsBatch(docs, db)
          .then(expect.fail)
          .catch(err => {
            expect(err).to.be.eq(expectedError)
          })
      })
      it('should warn if updateOneBatch returns mismatched modified length', function () {
        let item1 = {
          retsQueryStats: [] as Partial<Models.RetsQueryStats>[]
        }
        let expectedResult = {
          modifiedCount: 7
        }
        docs.push(item1)
        updateOneBatchStub.resolves(expectedResult)
        return subject.updateRetsQueryStatsBatch(docs, db)
          .then(result => {
            expect(result).to.be.eq(expectedResult)
            expect(logger.audit).to.have.been.called
            expect(logger.audit).to.have.been.calledWith(
              sinon.match.string,
              'warn',
              sinon.match.has('dbResponse', expectedResult)
            )
          })
      })
      it('should skip warn if updateOneBatch returns matching modifiedCount', function () {
        let item1 = {
          retsQueryStats: [{
            resourceName, className
          }]
        }
        let expectedResult = {
          modifiedCount: 1
        }
        docs.push(item1)
        updateOneBatchStub.resolves(expectedResult)
        return subject.updateRetsQueryStatsBatch(docs, db)
          .then(result => {
            expect(result).to.be.eq(expectedResult)
            expect(logger.audit).to.have.been.calledWith(sinon.match.string, 'info')
          })
      })
    })
  })
})
