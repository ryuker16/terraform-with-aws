/// <reference types="sinon-chai" />
/// <reference types="sinon-as-promised" />
/// <reference types="mocha" />

import { RetsTimestampPersister, IOptions } from '../../../src/lib/retsTimestampPersister'
import { Queues } from 'infrastructure-node-cloudservices-lib'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
chai.use(sinonChai)
import * as faker from 'faker'
import * as _ from 'lodash'
import * as Promise from 'bluebird'
import { EventEmitter } from 'events'

describe('RetsTimestampPersister', function () {
  it('should export execute()', function () {
    expect(RetsTimestampPersister.prototype.execute).to.be.a('function')
  })
  describe('execute(options)', function () {
    let subject: RetsTimestampPersister = null
    let consumer: any = null
    let mongoClient: any = null
    let lambda: any = null
    let lambdaContext: any = null
    let logger: any = null
    let importRepository: any = null
    let expectedError = new Error()
    let options: IOptions = null
    beforeEach(function () {
      expectedError = new Error(faker.random.uuid())
      lambda = sinon.stub({ invoke: _.noop })
      consumer = sinon.stub({
        consume: _.noop,
        on: _.noop,
        once: _.noop
      })
      mongoClient = sinon.stub({ connect: _.noop })
      lambdaContext = {
        functionName: faker.name.firstName(),
        getRemainingTimeInMillis: sinon.stub()
      }
      importRepository = sinon.stub({
        updateRetsQueryStatsBatch: _.noop
      })
      options = {
        queueBatchSize: faker.random.number(10),
        mongoConnection: faker.internet.url(),
        mongoDatabase: faker.name.firstName(),
        remainingMillisThreshold: faker.random.number(5000)
      }
      logger = sinon.stub({
        error: _.noop,
        audit: _.noop,
        telemetry: _.noop,
        mergeContext: _.noop
      })
      subject = new RetsTimestampPersister(
        lambda,
        lambdaContext,
        consumer,
        mongoClient,
        importRepository,
        logger)
    })
    it('should return a promise', function () {
      let p = subject.execute(null)
      expect(p.then).to.be.a('function')
      return p.catch((err) => err)
    })
    it('should reject without required options', function () {
      return subject.execute(null)
        .then(expect.fail)
        .catch(TypeError, (err) => {
          expect(err).to.be.instanceOf(Error)
        })
    })
    it('should consume queue with required options', function () {
      consumer.consume.rejects(expectedError)
      return subject.execute(options)
        .then(expect.fail)
        .catch((err) => {
          expect(err).to.be.eq(expectedError)
        })
    })
    it('should listen and set queueEmpty flag on empty', function () {
      consumer.once.withArgs('empty').callsArg(1)
      consumer.consume.rejects(expectedError)
      return subject.execute(options)
        .then(expect.fail)
        .catch((err) => {
          expect(err).to.be.eq(expectedError)
          expect(subject.queueEmpty).to.be.ok
        })
    })
    describe('consume queue options', function () {
      it('should specify IConsumeQueueOptions', function () {
        consumer.consume = function (consumeQueueOptions: Queues.IConsumeQueueOptions<any, any>) {
          expect(consumeQueueOptions).to.have.property('batchSize', options.queueBatchSize)
          expect(consumeQueueOptions).to.have.property('enableBatchProcessing', true)
          expect(consumeQueueOptions).to.have.property('handleMessageBatch')
            .and.be.a('function')
          expect(consumeQueueOptions).to.have.property('consumeUntil')
            .and.be.a('function')
          return Promise.reject(expectedError)
        }
        return subject.execute(options)
          .then(expect.fail)
          .catch((err) => expect(err).to.be.eq(expectedError))
      })
    })
    describe('during handleMessageBatch callback', function () {
      it('should set handleMessageBatchEntered, ensure db open/close, and check to self invoke after rejections', function () {
        let ensureDbAsync = sinon.stub(subject, 'ensureDbAsync').rejects(new Error(''))
        let closeDbAsync = sinon.stub(subject, 'closeDbAsync').rejects(new Error(''))
        sinon.stub(subject, 'selfInvokeAfterConsumeRejects').rejects(expectedError)
        consumer.consume = function (consumeQueueOptions: Queues.IConsumeQueueOptions<any, any>) {
          // connect should raise the expectedError
          return Promise.resolve(consumeQueueOptions.handleMessageBatch([]))
        }
        return subject.execute(options)
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(expectedError)
            expect(subject.messagesReceived).to.be.ok
            expect(ensureDbAsync, 'attempted open db').to.have.been.called
            expect(closeDbAsync, 'attempted close db').to.have.been.called
          })
      })
    })
    describe('consumeUntil', function () {
      it('should read getRemainingTimeInMillis from lambdaContext and return true if 0', function () {
        lambdaContext.getRemainingTimeInMillis.returns(0)
        let result = subject.consumeUntil(options)
        expect(result).to.be.ok
        expect(lambdaContext.getRemainingTimeInMillis).to.have.been.called
      })
      it('should return true (break) if remainingMillisThreshold is gte than remaining time', function () {
        let remainingTime = faker.random.number({ min: 100, max: 1000 })
        let remainingMillisThreshold = remainingTime
        lambdaContext.getRemainingTimeInMillis.returns(remainingTime)
        let result = subject.consumeUntil(_.merge(options, { remainingMillisThreshold }))
        expect(result).to.be.ok
        expect(lambdaContext.getRemainingTimeInMillis).to.have.been.called
        // should log breakpoint to telemetry
        expect(logger.telemetry).to.have.been.called
      })
      it('should return false (continue) if remainingTime is gt remainingMillisThreshold', function () {
        let remainingTime = faker.random.number({ min: 100, max: 1000 })
        let remainingMillisThreshold = faker.random.number(99)
        lambdaContext.getRemainingTimeInMillis.returns(remainingTime)
        let result = subject.consumeUntil(_.merge(options, { remainingMillisThreshold }))
        expect(result).to.be.false
        expect(lambdaContext.getRemainingTimeInMillis).to.have.been.called
      })
    })
    describe('selfInvokeAfterConsumeResolves', function () {
      it('should call selfInvokeAsync if messages received and queue is not empty', function () {
        subject.selfInvokeAsync = sinon.stub().rejects(expectedError)
        subject.queueEmpty = false
        subject.messagesReceived = true
        return Promise.resolve(subject.selfInvokeAfterConsumeResolves())
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(expectedError)
            expect(subject.selfInvokeAsync).to.have.been.called
          })
      })
      it('should not call selfInvokeAsync if messages were received and queue is empty', function () {
        subject.selfInvokeAsync = sinon.stub().rejects(expectedError)
        subject.queueEmpty = true
        subject.messagesReceived = true
        return Promise.resolve(subject.selfInvokeAfterConsumeResolves())
          .then(() => {
            expect(subject.selfInvokeAsync).not.to.have.been.called
          })
      })
      it('should not call selfInvokeAsync if messages were not processed', function () {
        subject.selfInvokeAsync = sinon.stub().rejects(expectedError)
        subject.queueEmpty = false
        subject.messagesReceived = false
        return Promise.resolve(subject.selfInvokeAfterConsumeResolves())
          .then(() => {
            expect(subject.selfInvokeAsync).not.to.have.been.called
          })
      })
    })
    describe('selfInvokeAfterConsumeRejects', function () {
      it('should call selfInvokeAsync if messages received and queue is not empty', function () {
        subject.selfInvokeAsync = sinon.stub().returns(Promise.reject(expectedError))
        subject.queueEmpty = false
        subject.messagesReceived = true
        return Promise.resolve(subject.selfInvokeAfterConsumeRejects())
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(expectedError)
            expect(subject.selfInvokeAsync).to.have.been.called
          })
      })
      it('should call selfInvokeAsync and warn of errors', function () {
        subject.selfInvokeAsync = sinon.stub().returns(Promise.reject(expectedError))
        subject.queueEmpty = false
        subject.messagesReceived = true
        return Promise.resolve(subject.selfInvokeAfterConsumeRejects(expectedError))
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(expectedError)
            expect(subject.selfInvokeAsync).to.have.been.called
            expect(logger.audit).to.have.been.calledWith(sinon.match.string, sinon.match('warn'))
          })
      })
      it('should not call selfInvokeAsync and raise error if messages were received and queue is empty', function () {
        subject.selfInvokeAsync = sinon.stub()
        subject.queueEmpty = true
        subject.messagesReceived = true
        return Promise.try(() => subject.selfInvokeAfterConsumeRejects(expectedError))
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(expectedError)
            expect(subject.selfInvokeAsync).not.to.have.been.called
          })
      })
      it('should not call selfInvokeAsync and raise error if messages were not received', function () {
        subject.selfInvokeAsync = sinon.stub()
        subject.queueEmpty = true
        subject.messagesReceived = false
        return Promise.try(() => subject.selfInvokeAfterConsumeRejects(expectedError))
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(expectedError)
            expect(subject.selfInvokeAsync).not.to.have.been.called
          })
      })
    })
    describe('db methods', function () {
      let database: any = null
      let dbEvents: EventEmitter = null
      beforeEach(function () {
        dbEvents = new EventEmitter()
        database = sinon.stub({
          collection: _.noop
        })
        database.on = dbEvents.on.bind(dbEvents)
        database.collection = sinon.stub()
        database.close = sinon.stub()
        subject.database = database
      })
      describe('closeDbAsync', function () {
        it('should call database.close', function () {
          return Promise.resolve(subject.closeDbAsync())
            .then(function () {
              expect(database.close).to.have.been.called
            })
        })
        it('should not call database.close if db not set', function () {
          subject.database = null
          return Promise.resolve(subject.closeDbAsync())
            .then(function () {
              expect(database.close).not.to.have.been.called
            })
        })
      })
      describe('ensureDbAsync', function () {
        beforeEach(function () {
          subject.database = null
        })
        it('should resolve the database if already set', function () {
          subject.database = database
          return Promise.resolve(subject.ensureDbAsync(options))
            .then(function (db) {
              expect(db).to.be.eq(subject.database)
            })
        })
        it('should call mongoClient.connect if no db', function () {
          subject.database = null
          mongoClient.connect.resolves(null)
          return Promise.resolve(subject.ensureDbAsync(options))
            .then(function () {
              expect(mongoClient.connect).to.have.been.calledWith(options.mongoConnection)
            })
        })
        it('should set this.database to the connected db', function () {
          subject.database = null
          mongoClient.connect.resolves({
            db: sinon.stub().withArgs('placester_production').returns(database)
          })
          return Promise.resolve(subject.ensureDbAsync(options))
            .then(function (db) {
              expect(db).to.be.eq(subject.database)
              expect(subject.database).to.be.eq(db)
            })
        })
        it('should listen to reconnect and error events and log each', function () {
          mongoClient.connect.resolves({
            db: sinon.stub().returns(database)
          })
          return Promise.resolve(subject.ensureDbAsync(options))
            .then(function (db) {
              dbEvents.emit('reconnect')
              dbEvents.emit('error', expectedError)
              expect(logger.audit).to.have.callCount(2)
              expect(logger.audit.getCall(0)).to.have.been.calledWith(
                sinon.match.string,
                'info')
              expect(logger.audit.getCall(1)).to.have.been.calledWith(
                sinon.match.string,
                'warn',
                sinon.match.has('err', expectedError))
            })
        })
      })
      describe('handleMessageBatch', function () {
        let messages: any[] = null
        beforeEach(function () {
          messages = []
        })
        it('should reject if ensureDbAsync rejects', function () {
          subject.ensureDbAsync = sinon.stub().rejects(expectedError)
          return Promise.resolve(subject.handleMessageBatch(options, []))
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
            })
        })
        it('should persistMessageBatch with messages and db', function () {
          subject.ensureDbAsync = sinon.stub().resolves(database)
          subject.persistMessageBatch = sinon.stub().rejects(expectedError)
          return Promise.resolve(subject.handleMessageBatch(options, messages))
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              expect(subject.persistMessageBatch).to.have.been.calledWith(messages, database, options)
            })
        })
        it('should audit the persistMessageBatch response', function () {
          let expectedResponse = { foo: 'bar' }
          subject.ensureDbAsync = sinon.stub().resolves(database)
          subject.persistMessageBatch = sinon.stub().resolves(expectedResponse)
          return Promise.resolve(subject.handleMessageBatch(options, messages))
            .then(result => {
              expect(result).to.be.eq(expectedResponse)
              expect(logger.audit).to.have.been.called
            })
        })
      })
      describe('persistMessageBatch', function () {
        let messages: any[] = null
        let messagesData: any[] = null
        beforeEach(function () {
          messages = []
          messagesData = []
          _.times(faker.random.number({ min: 1, max: 10 }), () => {
            let data = {
              context: {
                correlationId: faker.random.uuid()
              }
            }
            messagesData.push(data)
            messages.push({
              Data: {
                Message: JSON.stringify(data)
              }
            })
          })
        })
        it('should reject if updateRetsQueryStatsBatch rejects', function () {
          importRepository.updateRetsQueryStatsBatch.rejects(expectedError)
          return Promise.resolve(subject.persistMessageBatch(messages, database, options))
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
            })
        })
        it('should persistMessageBatch with each parsed msg.Data.Message', function () {
          importRepository.updateRetsQueryStatsBatch.rejects(expectedError)
          return Promise.resolve(subject.persistMessageBatch(messages, database, options))
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              let retsStatsAvailableList: any[] = importRepository.updateRetsQueryStatsBatch
                .getCall(0)
                .args[0]
              _.times(messagesData.length, (n) => {
                expect(retsStatsAvailableList[n]).to.deep.eq(messagesData[n])
              })
            })
        })
        it('should return the updateRetsQueryStatsBatch response and have set log context', function () {
          let expectedResponse = { foo: 'bar' }
          importRepository.updateRetsQueryStatsBatch.resolves(expectedResponse)
          return Promise.resolve(subject.persistMessageBatch(messages, database, options))
            .then(result => {
              expect(result).to.be.eq(expectedResponse)
              expect(logger.mergeContext).to.have.callCount(messages.length)
              expect(logger.mergeContext).to.have.been.calledWith(messagesData[0].context)
            })
        })
      })
    })
  })
})
