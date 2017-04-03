/// <reference types="sinon-chai" />
/// <reference types="sinon-as-promised" />
/// <reference types="mocha" />

import { DeliveryStreamS3RecordsExtractor } from '../../../src/lib/deliveryStreamS3RecordsExtractor'
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
import { Extraction } from 'etl'
import * as AWS from 'aws-sdk'
const S3 = new AWS.S3()

interface SampleRecordType extends Extraction.Request {

}
describe('DeliveryStreamS3RecordsExtractor', function () {
  describe('constructor', function () {
    it('should throw TypeError without logger and s3', function () {
      expect(() => {
        return new DeliveryStreamS3RecordsExtractor(null, null)
      }).to.throw(TypeError)
      expect(() => {
        return new DeliveryStreamS3RecordsExtractor({} as any, null)
      }).to.throw(TypeError)
      expect(() => {
        return new DeliveryStreamS3RecordsExtractor({} as any, { getObject: _.noop } as any)
      }).not.to.throw(TypeError)
    })
  })
  it('prototype should expose extractRecords()', function () {
    expect(DeliveryStreamS3RecordsExtractor.prototype.extractRecords).to.be.a('function')
  })
  describe('extractRecords', function () {
    let sandbox: sinon.SinonSandbox = null
    let s3: any = null
    let logger: any = null
    let recordExtractor: DeliveryStreamS3RecordsExtractor = null
    let getObjectStub: sinon.SinonStub = null
    let expectedError: Error = null

    beforeEach(function () {
      sandbox = sinon.sandbox.create()
      logger = sandbox.stub({
        audit: _.noop,
        error: _.noop
      })
      s3 = sinon.stub({
        getObject: _.noop
      })
      getObjectStub = sandbox.stub()
      s3.getObject = getObjectStub
      expectedError = new Error('expected')
      recordExtractor = new DeliveryStreamS3RecordsExtractor(logger, s3)
    })

    afterEach(function () {
      sandbox.restore()
    })

    describe('using sample data from firehose', function () {
      let sampleContent: Buffer = null
      let folder = 'stream-etl-entities-property-transformed-2017/02/08/23/'
      let key = 'stream-etl-entities-property-2-2017-02-08-23-48-41-8e1d1a49-3d34-4849-ade4-7626203b770e'
      before(function () {
        return Promise.fromCallback(callback => fs.readFile(
          path.resolve(__dirname, '../../../../documentation/', key),
          callback))
          .tap((content: Buffer) => {
            sampleContent = content
          })
          .then((content: Buffer) => {
            console.log(`read a ${content.length} sized ${typeof content} from ${key}`)
          })
      })
      it('should parse X docs from sample file as a string', function () {
        getObjectStub.returns({
          promise: sinon.stub().resolves({
            Body: sampleContent.toString()
          })
        })
        let source = recordExtractor.extractRecords<SampleRecordType>({} as any)
        return source
          .toArray()
          .toPromise()
          .then((records) => {
            expect(records.length).to.be.at.least(15)
          })
      })
      it('should throw an error if the content is null', function () {
        getObjectStub.returns({
          promise: sinon.stub().resolves({
            Body: null
          })
        })
        let source = recordExtractor.extractRecords<SampleRecordType>({} as any)
        return source
          .toPromise(Promise)
          .then(
            (result) => expect.fail(result, null, 'should have rejected'),
            (err) => expect(err.message).to.be.eq('Body is not string or Buffer')
          )
      })
      it('should parse X docs from sample file as Buffer', function () {
        getObjectStub.returns({
          promise: sinon.stub().resolves({
            Body: sampleContent
          })
        })
        let source = recordExtractor.extractRecords<SampleRecordType>({} as any)
        return source
          .toArray()
          .toPromise()
          .then((records) => {
            expect(records.length).to.be.at.least(15)
          })
      })
      it('should audit log fetching object from S3', function () {
        getObjectStub.returns({
          promise: sinon.stub().resolves({
            Body: sampleContent
          })
        })
        const source = recordExtractor.extractRecords<SampleRecordType>({} as any)
        return source
          .toArray()
          .toPromise(Promise)
          .then(
            (records) => expect(logger.audit).to.have.been.calledOnce,
            (err) => expect(err).to.be.null
          )
      })
      it('should throw with the error from getObject', function () {
        getObjectStub.returns({
          // bluebird promise
          promise: () => Promise.reject(expectedError)
          // promise: sandbox.stub().rejects(expectedError)
        })
        let source = recordExtractor.extractRecords<SampleRecordType>({} as any)
        return source
          .toArray()
          .toPromise(Promise)
          .then(expect.fail)
          .catch(err => expect(err).to.be.eq(expectedError))
      })
      /**
       * Should be an integration test
       */
      xit('should parse X docs from live s3', function () {
        getObjectStub.returns({
          promise: () => Promise.resolve(S3.getObject({
            Bucket: 'pl-internal-etl-entities-property-canonical',
            Key: `${folder}${key}`
          }).promise())
            .tap(getObjectOutput => {
              console.log('getObjectOutput.Body is', typeof getObjectOutput.Body)
              console.log(_.pick(getObjectOutput, [
                'ContentEncoding',
                'ContentRange',
                'ContentType'
              ]))
            })
        })
        let source = recordExtractor.extractRecords<SampleRecordType>({} as any)
        return source
          .toArray()
          .toPromise()
          .then((records) => {
            expect(records.length).to.be.at.least(15)
            _.forEach(records, record => {
              expect(record).to.have.property('transformedDocumentBody')
                .that.is.a('object')
            })
          })
      })
    })
  })
})
