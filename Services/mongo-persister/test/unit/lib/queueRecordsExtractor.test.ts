/// <reference types="sinon-chai" />
/// <reference types="sinon-as-promised" />
/// <reference types="mocha" />

import { QueueRecordsExtractor } from '../../../src/lib/queueRecordsExtractor'
import { Queues } from 'infrastructure-node-cloudservices-lib'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
chai.use(sinonChai)
import * as faker from 'faker'
import * as _ from 'lodash'
import * as Promise from 'bluebird'
import * as path from 'path'
import * as fs from 'fs'
import * as Rx from 'rx'
import { Extraction, Contracts } from 'etl'
import * as AWS from 'aws-sdk'
import * as Faker from 'faker'
const S3 = new AWS.S3()

interface SampleRecordType extends Extraction.Request {

}
describe('QueueRecordsExtractor', function () {
  describe('constructor', function () {
    it('should throw TypeError without DeliveryStreamS3RecordsExtractor', function () {
      expect(() => {
        return new QueueRecordsExtractor(null)
      }).to.throw(TypeError)
      expect(() => {
        return new QueueRecordsExtractor({} as any)
      }).to.throw(TypeError)
      expect(() => {
        return new QueueRecordsExtractor({ extractRecords: _.noop } as any)
      }).not.to.throw(TypeError)
    })
  })
  it('prototype should expose sourceRetsDocumentTransformed()', function () {
    expect(QueueRecordsExtractor.prototype.sourceRetsDocumentTransformed).to.be.a('function')
  })
  describe('sourceRetsDocumentTransformed', function () {
    let sandbox: sinon.SinonSandbox = null
    let recordExtractor: any = null
    let queueRecordsExtractor: QueueRecordsExtractor = null
    let getObjectStub: sinon.SinonStub = null
    let expectedError: Error = null
    let rdt: Contracts.RetsDocumentTransformed = null
    let isRetsDocumentsTransformedFromFirehose: any = null
    let isRetsDocumentTransformedFromSns: any = null
    let isRetsDocumentsTransformedFromFirehoseRelayed: any = null
    let nRecords = 0
    let bucket = ''
    let key = ''
    let s3EventRecord: AwsContracts.S3EventRecordMessage = null
    beforeEach(function () {
      nRecords = Faker.random.number({ min: 1, max: 3 })
      sandbox = sinon.sandbox.create()
      recordExtractor = sandbox.stub({
        extractRecords: _.noop
      })
      expectedError = new Error('expected')
      queueRecordsExtractor = new QueueRecordsExtractor(recordExtractor)
      bucket = Faker.address.city()
      key = Faker.random.uuid()
      rdt = {
        config: {},
        context: {},
        transformedDocumentBody: {}
      } as any
      s3EventRecord = {
        eventSource: 'aws:s3',
        s3: null
      }
      _.set(s3EventRecord, 's3.bucket.name', bucket)
      _.set(s3EventRecord, 's3.object.key', key)
      isRetsDocumentsTransformedFromFirehose = {
        Data: {
          Type: 'Notification',
          Message: JSON.stringify({
            Records: _.times(nRecords, (n) => {
              return s3EventRecord
            })
          })
        }
      }
      isRetsDocumentTransformedFromSns = {
        Data: {
          Type: 'Notification',
          Message: JSON.stringify(rdt)
        }
      }
      isRetsDocumentsTransformedFromFirehoseRelayed = {
        Data: s3EventRecord
      }
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('should return records if Firehose > S3 > SNS<S3EventRecordMessage> > SQS(SNS(S3EventRecordMessage))', function () {
      recordExtractor.extractRecords.returns(Rx.Observable.from(_.times(nRecords, (n) => {
        return {
          record: n
        }
      })))
      let source = queueRecordsExtractor.sourceRetsDocumentTransformed(isRetsDocumentsTransformedFromFirehose)
      return source
        .toArray()
        .toPromise()
        .then((records) => {
          // nRecords of s3EventRecord each returning Observable of nRecords
          expect(records).to.have.lengthOf(nRecords * nRecords)
          expect(recordExtractor.extractRecords).to.have.been.calledWith(sinon.match.has('bucket', bucket))
          expect(recordExtractor.extractRecords).to.have.been.calledWith(sinon.match.has('key', key))
        })
    })
    it('should return records if Firehose > S3 > SNS<S3EventRecordMessage> > SnsQueueRelay lambda > SQS<S3EventRecordMessage>', function () {
      recordExtractor.extractRecords.returns(Rx.Observable.from(_.times(nRecords, (n) => {
        return {
          record: n
        }
      })))
      let source = queueRecordsExtractor.sourceRetsDocumentTransformed(isRetsDocumentsTransformedFromFirehoseRelayed)
      return source
        .toArray()
        .toPromise()
        .then((records) => {
          // one s3EventRecord returning Observable of nRecords
          expect(records).to.have.lengthOf(nRecords)
          expect(recordExtractor.extractRecords).to.have.been.calledWith(sinon.match.has('bucket', bucket))
          expect(recordExtractor.extractRecords).to.have.been.calledWith(sinon.match.has('key', key))
        })
    })
    it('should return records if Transformer > SNS(RetsDocumentTransformed) > SQS(SNS(RetsDocumentTransformed))', function () {
      return queueRecordsExtractor.sourceRetsDocumentTransformed(isRetsDocumentTransformedFromSns)
        .toArray()
        .toPromise()
        .then((records) => {
          expect(records).to.have.lengthOf(1)
          expect(recordExtractor.extractRecords).not.to.have.been.called
        })
    })
  })
})
