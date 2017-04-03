/// <reference types="sinon-chai" />
/// <reference types="sinon-as-promised" />
/// <reference types="mocha" />

import { ExtractDispatcher } from '../../src/extractDispatcher'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
chai.use(sinonChai)
import * as Faker from 'faker'
import { Contracts } from 'etl'
import * as moment from 'moment'

describe('ExtractDispatcher', function () {
  let subject: ExtractDispatcher = null
  let mapper: any = null
  let extractor: any = null
  let publisher: any = null
  let logger: any = null
  let event: Contracts.ExtractSchedulerTriggeredEvent = null
  let expectedError = null
  let context: any = null
  let imports: any[] = []
  beforeEach(function () {
    const fn = function () {
      // noop
    }
    logger = sinon.stub({ error: fn, audit: fn })
    extractor = sinon.stub({ getScheduledImports: fn })
    mapper = sinon.stub({ buildExtractionRequest: fn })
    publisher = sinon.stub({
      publishMessage: fn
    })
    subject = new ExtractDispatcher(
      extractor,
      publisher,
      mapper,
      logger)
    event = {
      dispatcher: {
        scheduleId: Faker.random.uuid(),
        queueUrl: Faker.internet.url(),
        protocol: 'RETS'
      }
    }
    context = {

    }
    let times = Faker.random.number({ min: 1, max: 10 })
    imports = []
    for (let i = 0; i < times; i++) {
      imports.push({ _id: Faker.random.uuid })
    }
    expectedError = new Error(Faker.internet.domainName())
  })
  describe('run', function () {
    it('should return a promise', function () {
      let p = subject.run(event, null)
      expect(p.then).to.be.a('function')
      return p.catch((err) => err)
    })
    it('should reject if getScheduledImports rejects', function () {
      extractor.getScheduledImports.rejects(expectedError)
      return subject.run(event, context)
        .then(expect.fail)
        .catch(err => {
          expect(err).to.be.eq(expectedError)
        })
    })
    it('should processImport & buildExtractionRequest for each getScheduledImports rejects', function () {
      extractor.getScheduledImports.resolves(imports)
      publisher.publishMessage.resolves({MessageId: Faker.random.uuid()})
      mapper.buildExtractionRequest.onCall(imports.length - 1).throws(expectedError)
      return subject.run(event, context)
        .then(results => {
          expect(results).to.have.property('successCount', imports.length - 1)
          expect(mapper.buildExtractionRequest).to.have.callCount(imports.length)
          expect(publisher.publishMessage).to.have.callCount(imports.length - 1)
          expect(mapper.buildExtractionRequest.getCall(0)).to.have.been.calledWith(imports[0])
          expect(logger.audit).to.have.been.called
        })
    })
  })
  describe('buildContext', function () {
    it('should build correlationID', function () {
      let context = ExtractDispatcher.buildContext(event, { awsRequestId: null } as any)
      expect(context).to.have.property('correlationID')
      let uid = Faker.random.uuid()
      context = ExtractDispatcher.buildContext(event, { awsRequestId: uid } as any)
      expect(context).to.have.property('correlationID', uid)
    })
    it('should default startTime and stand up period', function () {
      let context = ExtractDispatcher.buildContext(event, { awsRequestId: null } as any)
      expect(context).to.have.property('correlationID')
      let uid = Faker.random.uuid()
      context = ExtractDispatcher.buildContext(event, { awsRequestId: uid } as any)
      expect(context).to.have.property('startTime')
      expect(context).to.have.property('period')
      expect(moment(context.startTime).isValid()).to.be.ok
    })
  })
})
