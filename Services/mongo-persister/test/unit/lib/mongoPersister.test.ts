/// <reference types="sinon-chai" />
/// <reference types="sinon-as-promised" />
/// <reference types="mocha" />

import { MongoPersister, IOptions } from '../../../src/lib/mongoPersister'
import { Queues } from 'infrastructure-node-cloudservices-lib'
import { QueueRecordsExtractor } from '../../../src/lib/queueRecordsExtractor'
import { DeliveryStreamS3RecordsExtractor } from '../../../src/lib/deliveryStreamS3RecordsExtractor'
import { Contracts } from 'etl'

import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
chai.use(sinonChai)
import * as Faker from 'faker'
import * as _ from 'lodash'
import * as Promise from 'bluebird'
import { EventEmitter } from 'events'
import { MongoError } from 'mongodb'

describe('MongoPersister', function () {
  it('should export execute()', function () {
    expect(MongoPersister.prototype.execute).to.be.a('function')
  })
  describe('execute(options)', function () {
    let sandbox: sinon.SinonSandbox = null
    let subject: MongoPersister = null
    let consumer: any = null
    let mongoClient: any = null
    let lambda: any = null
    let lambdaContext: any = null
    let logger: any = null
    let expectedError = new Error()
    let options: IOptions = null
    let documentRepo: any = null
    let documentPersister: any = null
    let queueRecordsExtractor: QueueRecordsExtractor = null
    let deliveryStreamRecordsExtractor: DeliveryStreamS3RecordsExtractor = null
    let getObjectStub: sinon.SinonStub = null
    beforeEach(function () {
      sandbox = sinon.sandbox.create()
      expectedError = new Error(Faker.random.uuid())
      lambda = sandbox.stub({ invoke: _.noop })
      consumer = sandbox.stub({
        consume: _.noop,
        on: _.noop,
        once: _.noop
      })
      mongoClient = sandbox.stub({ connect: _.noop })
      lambdaContext = {
        functionName: Faker.name.firstName(),
        getRemainingTimeInMillis: sandbox.stub()
      }
      options = {
        upsertMode: 'single',
        queueBatchSize: Faker.random.number(10),
        mongoConnection: Faker.internet.url(),
        remainingMillisThreshold: Faker.random.number(5000)
      }
      logger = sandbox.stub({
        error: _.noop,
        audit: _.noop,
        telemetry: _.noop,
        setContext: _.noop
      })
      documentRepo = sandbox.stub({
        getByKey: _.noop
      })
      documentPersister = sandbox.stub({
        upsertOneResoDoc: _.noop,
        upsertBatchResoDocs: _.noop
      })
      getObjectStub = sandbox.stub()
      const s3 = {
        getObject: getObjectStub
      }
      deliveryStreamRecordsExtractor = new DeliveryStreamS3RecordsExtractor(logger, s3 as any)
      queueRecordsExtractor = new QueueRecordsExtractor(deliveryStreamRecordsExtractor)
      subject = new MongoPersister(
        lambda,
        lambdaContext,
        consumer,
        documentRepo,
        documentPersister,
        mongoClient,
        queueRecordsExtractor,
        logger)
    })
    afterEach(() => sandbox.restore())
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
      it('should set messagesReceived, ensure db open/close, and check to self invoke after rejections', function () {
        let ensureDbAsync = sandbox.stub(subject, 'ensureDbAsync').rejects(new Error(''))
        let closeDbAsync = sandbox.stub(subject, 'closeDbAsync').rejects(new Error(''))
        sandbox.stub(subject, 'selfInvokeAfterConsumeRejects').rejects(expectedError)
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
        let remainingTime = Faker.random.number({ min: 100, max: 1000 })
        let remainingMillisThreshold = remainingTime
        lambdaContext.getRemainingTimeInMillis.returns(remainingTime)
        let result = subject.consumeUntil(_.merge(options, { remainingMillisThreshold }))
        expect(result).to.be.ok
        expect(lambdaContext.getRemainingTimeInMillis).to.have.been.called
        // should log breakpoint to telemetry
        expect(logger.telemetry).to.have.been.called
      })
      it('should return false (continue) if remainingTime is gt remainingMillisThreshold', function () {
        let remainingTime = Faker.random.number({ min: 100, max: 1000 })
        let remainingMillisThreshold = Faker.random.number(99)
        lambdaContext.getRemainingTimeInMillis.returns(remainingTime)
        let result = subject.consumeUntil(_.merge(options, { remainingMillisThreshold }))
        expect(result).to.be.false
        expect(lambdaContext.getRemainingTimeInMillis).to.have.been.called
      })
    })
    describe('selfInvokeAfterConsumeResolves', function () {
      it('should call selfInvokeAsync if messages received and queue is not empty', function () {
        subject.selfInvokeAsync = sandbox.stub().rejects(expectedError)
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
        subject.selfInvokeAsync = sandbox.stub().rejects(expectedError)
        subject.queueEmpty = true
        subject.messagesReceived = true
        return Promise.resolve(subject.selfInvokeAfterConsumeResolves())
          .then(() => {
            expect(subject.selfInvokeAsync).not.to.have.been.called
          })
      })
      it('should not call selfInvokeAsync if messages were not processed', function () {
        subject.selfInvokeAsync = sandbox.stub().rejects(expectedError)
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
        subject.selfInvokeAsync = sandbox.stub().returns(Promise.reject(expectedError))
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
        subject.selfInvokeAsync = sandbox.stub().returns(Promise.reject(expectedError))
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
      it('should not call selfInvokeAsync and raise error if the error is a MongoError', function () {
        subject.selfInvokeAsync = sandbox.stub()
        subject.queueEmpty = false
        subject.messagesReceived = true
        let mongoError = new MongoError(Faker.name.firstName())
        return Promise.try(() => subject.selfInvokeAfterConsumeRejects(mongoError))
          .then(expect.fail)
          .catch((err) => {
            expect(err).to.be.eq(mongoError)
            expect(subject.selfInvokeAsync).not.to.have.been.called
          })
      })
      it('should not call selfInvokeAsync and raise error if messages were received and queue is empty', function () {
        subject.selfInvokeAsync = sandbox.stub()
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
        subject.selfInvokeAsync = sandbox.stub()
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
        database = sandbox.stub({
          collection: _.noop
        })
        database.on = dbEvents.on.bind(dbEvents)
        database.collection = sandbox.stub()
        database.close = sandbox.stub()
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
          mongoClient.connect.resolves({
            db: sandbox.stub().returns(null)
          })
          return Promise.resolve(subject.ensureDbAsync(options))
            .then(function () {
              expect(mongoClient.connect).to.have.been.calledWith(options.mongoConnection)
            })
        })
        it('should set this.database to the connected db', function () {
          subject.database = null
          mongoClient.connect.resolves({
            db: sandbox.stub().returns(database)
          })
          return Promise.resolve(subject.ensureDbAsync(options))
            .then(function (db) {
              expect(db).to.be.eq(subject.database)
              expect(subject.database).to.be.eq(db)
            })
        })
        it('should listen to reconnect and error events and log each', function () {
          mongoClient.connect.resolves({
            db: sandbox.stub().returns(database)
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
          subject.ensureDbAsync = sandbox.stub().rejects(expectedError)
          return Promise.resolve(subject.handleMessageBatch(options, []))
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
            })
        })
        it('should persistMessageBatch with messages and db', function () {
          subject.ensureDbAsync = sandbox.stub().resolves(database)
          subject.persistMessageBatch = sandbox.stub().rejects(expectedError)
          return Promise.resolve(subject.handleMessageBatch(options, messages))
            .then(expect.fail)
            .catch(err => {
              expect(err).to.be.eq(expectedError)
              expect(subject.persistMessageBatch).to.have.been.calledWith(messages, database, options)
            })
        })
        it('should audit the persistMessageBatch response', function () {
          let expectedResponse = { foo: 'bar' }
          subject.ensureDbAsync = sandbox.stub().resolves(database)
          subject.persistMessageBatch = sandbox.stub().resolves(expectedResponse)
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
        let persistRetsDocumentTransformedBatchStub: sinon.SinonStub = null
        let persistRetsDocumentTransformedStub: sinon.SinonStub = null
        let destinationCollection = ''
        let sourceRetsDocumentTransformedSpy: sinon.SinonSpy = null
        beforeEach(function () {
          messages = []
          messagesData = []
          persistRetsDocumentTransformedBatchStub = sandbox.stub()
          persistRetsDocumentTransformedStub = sandbox.stub()
          destinationCollection = Faker.address.state()
          sourceRetsDocumentTransformedSpy = sandbox.spy(queueRecordsExtractor, 'sourceRetsDocumentTransformed')
          _.times(Faker.random.number({ min: 2, max: 10 }), () => {
            let data: Contracts.RetsDocumentTransformed = {
              context: {
                correlationId: Faker.random.uuid()
              },
              transformedDocumentBody: {
                foo: Faker.name.firstName()
              },
              config: {
                // all documents go to same destinationCollection
                destinationCollection
              }
            } as any
            messagesData.push(data)
            messages.push({
              Data: {
                Message: JSON.stringify(data),
                // regard as direct SNS > SQS message
                Type: 'Notification',
                Signature: Faker.random.uuid()
              }
            })
          })
        })
        describe('when upsertMode single', function () {
          beforeEach(function () {
            options.upsertMode = 'single'
          })
          it('should reject if any persistRetsDocumentTransformed rejects', function () {
            subject.persistRetsDocumentTransformed = persistRetsDocumentTransformedStub
            persistRetsDocumentTransformedStub.onCall(0).resolves({ nModified: 1 })
            persistRetsDocumentTransformedStub.onCall(1).rejects(expectedError)
            return Promise.resolve(subject.persistMessageBatch(messages, database, options))
              .then(expect.fail)
              .catch(err => {
                expect(err).to.be.eq(expectedError)
              })
          })
          it('should persistRetsDocumentTransformed with each parsed msg.Data.Message as RetsDocumentTransformed', function () {
            _.times(messagesData.length - 1, (n) => {
              persistRetsDocumentTransformedStub.onCall(n).resolves(messagesData[n])
            })
            persistRetsDocumentTransformedStub.onCall(messagesData.length - 1).rejects(expectedError)
            subject.persistRetsDocumentTransformed = persistRetsDocumentTransformedStub
            return Promise.resolve(subject.persistMessageBatch(messages, database, options))
              .then(expect.fail)
              .catch(err => {
                expect(err).to.be.eq(expectedError)
                _.each(messagesData, (restDocumentTransformed, index) => {
                  let record = persistRetsDocumentTransformedStub.getCall(index).args[0]
                  expect(record, 'message.Data.Data passed to persistRetsDocumentTransformed')
                    .to.deep.eq(restDocumentTransformed)
                })
              })
          })
          it('should pass the parse & mapped { transformedDocumentBody } to upsertOneResoDoc individually', function () {
            _.times(messagesData.length - 1, n => {
              documentPersister.upsertOneResoDoc.onCall(n).resolves({})
            })

            documentPersister.upsertOneResoDoc.onCall(messagesData.length - 1).rejects(expectedError)
            return Promise.resolve(subject.persistMessageBatch(messages, database, options))
              .catch(err => {
                console.error(err)
                expect(err).to.be.eq(expectedError)
                _.times(messagesData.length, function (i) {
                  let upsertOneResoDocArg = documentPersister.upsertOneResoDoc.getCall(i).args[0]
                  expect(upsertOneResoDocArg).to.be.deep.eq(messagesData[i].transformedDocumentBody)
                })
              })
          })
        })
        describe('when upsertMode batch', function () {
          let persistRetsDocumentTransformedBatchSpy: sinon.SinonSpy = null
          beforeEach(function () {
            options.upsertMode = 'batch'
            persistRetsDocumentTransformedBatchSpy = sinon.spy(subject, 'persistRetsDocumentTransformedBatch')
          })
          it('should in batch also persistRetsDocumentTransformedBatch with the array of msg.Data.Message', function () {
            documentPersister.upsertBatchResoDocs.rejects(expectedError)
            return Promise.resolve(subject.persistMessageBatch(messages, database, options))
              .then(expect.fail)
              .catch(err => {
                expect(sourceRetsDocumentTransformedSpy).to.have.callCount(messages.length)
                expect(persistRetsDocumentTransformedBatchSpy).to.have.callCount(1)
                let storeBatchDocuments = documentPersister.upsertBatchResoDocs.getCall(0).args[0]
                _.forEach(storeBatchDocuments, (document, n: number) => {
                  expect(document, 'transformedDocumentBody passed to storeBatch documents').to.deep.eq(messagesData[n].transformedDocumentBody)
                })
                expect(err).to.be.eq(expectedError)
              })
          })
          it('should setContext for the logger and persistRetsDocumentTransformedBatch and upsertBatchResoDocs for all records', function () {
            documentPersister.upsertBatchResoDocs.rejects(expectedError)
            return Promise.resolve(subject.persistMessageBatch(messages, database, options))
              .then(expect.fail)
              .catch(err => {
                expect(persistRetsDocumentTransformedBatchSpy).to.have.callCount(1)
                let propertiesArg = persistRetsDocumentTransformedBatchSpy.getCall(0).args[0]
                expect(propertiesArg).to.be.a('array')
                expect(propertiesArg).to.have.lengthOf(messagesData.length)
                expect(logger.setContext).to.have.callCount(1)
                expect(err).to.be.eq(expectedError)
              })
          })
        })
      })// end persistMessageBatch
    })
  })
})
