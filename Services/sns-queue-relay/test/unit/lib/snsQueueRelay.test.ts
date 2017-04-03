import { SNSQueueRelay } from '../../../src/lib/snsQueueRelay'
import * as Promise from 'bluebird'
import * as chai from 'chai'
import * as crypto from 'crypto'
import * as faker from 'faker'
import * as fs from 'fs'
import * as _ from 'lodash'
import * as path from 'path'
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
const expect = chai.expect

chai.use(sinonChai)

describe('SNSQueRelay', function () {
  it('should export relay()', function () {
    expect(SNSQueueRelay.prototype.relay).to.be.a('function')
  })
  describe('generateDeduplicationID(record)', function () {
    let s3Message: any = null
    let bucketArn: string = null
    let key: string = null
    let queue: any = null
    let logger: any = null
    let config: any = null
    let source: SNSQueueRelay = null

    beforeEach(function () {
      bucketArn = faker.random.uuid()
      key = faker.random.uuid()
      s3Message = sinon.stub({
        eventSource: '',
        s3: {
          bucket: { arn: bucketArn, name: faker.name.firstName() },
          object: { key: key }
        }
      })
      logger = sinon.stub({
        error: _.noop,
        audit: _.noop,
        telemetry: _.noop,
        mergeContext: _.noop
      })
      config = sinon.stub({
        get: _.noop
      })
      source = new SNSQueueRelay(queue, config, logger)
    })

    it('generates a predictable hash', function () {
      const id = source.generateDeduplicationID(s3Message)
      const alsoId = source.generateDeduplicationID(s3Message)
      expect(id).to.eq(alsoId)
    })
  })
  describe('relay(event)', function () {
    let queue: any = null
    let logger: any = null
    let config: any = null
    let source: SNSQueueRelay = null
    let sampleEvent: any = null
    let sendMessageDotPromise: sinon.SinonStub = null

    before(function () {
      return Promise.fromCallback(callback => fs.readFile(
        path.resolve(__dirname, '../../../../testdata/sample.json'), callback))
        .then((content: Buffer) => {
          sampleEvent = JSON.parse(content.toString())
        })
    })

    beforeEach(function () {
      sendMessageDotPromise = sinon.stub()
      queue = {
        sendMessage: sinon.stub().returns({ promise: sendMessageDotPromise })
      }
      logger = sinon.stub({
        error: _.noop,
        audit: _.noop,
        telemetry: _.noop,
        mergeContext: _.noop
      })
      config = sinon.stub({
        get: _.noop
      })
      source = new SNSQueueRelay(queue, config, logger)
    })

    it('should return a promise', function () {
      let p = source.relay(null)
      expect(p.then).to.be.a('function')
      return p.catch(err => err)
    })

    it('should reject with null event', function () {
      return source.relay(null)
        .then(expect.fail)
        .catch(TypeError, (err) => {
          expect(err).to.be.instanceof(Error)
        })
    })

    it('should log a sendMessage error', function () {
      sendMessageDotPromise.rejects({})
      return source.relay(sampleEvent)
        .then(expect.fail)
        .catch((err: Error) => {
          expect(err).to.not.be.null
          sinon.assert.calledOnce(logger.error)
        })
    })

    it('should not reject a sample record', function () {
      sendMessageDotPromise.resolves({})
      return source.relay(sampleEvent)
        .then(
        (response) => {
          expect(response).to.not.be.null
          expect(queue.sendMessage).to.have.been.calledOnce
          sinon.assert.calledWith(queue.sendMessage, sinon.match.has('MessageBody', sinon.match.string))
          // s3.bucket.name from testdata is etl-extract-rets15-extracted-documents
          sinon.assert.calledWith(queue.sendMessage, sinon.match.has('MessageGroupId', 'etl-extract-rets15-extracted-documents'))
          sinon.assert.calledWith(queue.sendMessage, sinon.match.has('MessageDeduplicationId', sinon.match.string))
          sinon.assert.calledOnce(sendMessageDotPromise)
        },
        (err) => expect(err).to.be.null)
    })

  })
})
