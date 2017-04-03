/// <reference types="sinon-chai" />
import { DocumentStorage } from '../../../src/lib/documentStorage'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
// signals chai to adopt sinon expectations
chai.use(sinonChai)
// signals sinon to extend with resolves/rejects
import * as Faker from 'faker'
import * as Promise from 'bluebird'

describe('documentRepo', function () {

  it('should export two functions:, getByKey,storeByKey', function () {
    expect(DocumentStorage.prototype.getByKey).to.be.a('function')
    expect(DocumentStorage.prototype.storeByKey).to.be.a('function')
  })

  describe('methods', function () {
    let subject: DocumentStorage = null
    let client: any = null
    let document: Document = null
    let bucket: string
    let key: string
    beforeEach(function () {
      const fn = function () {
        // noop
        return true
      }
      bucket = Faker.name.firstName()
      key = Faker.random.uuid()

      // stub client object
      client = sinon.stub({
        putObject: fn,
        getObject: fn
      })
      // create new document repo
      subject = new DocumentStorage(client)
    })

    describe('getByKey(options)', function () {
      it('should call S3.getObject', function () {
        let resolvedValue = Faker.random.uuid()
        let getObjectDotPromise = sinon.stub()
        getObjectDotPromise.returns(Promise.resolve(resolvedValue))
        // same as below using sinon-as-promised
        getObjectDotPromise.resolves(resolvedValue)
        client.getObject.returns({
          // getObject().promise() resolves .then with the 'resolvedValue' aka extractedDocument
          promise: getObjectDotPromise
        })
        return subject.getByKey(bucket, key)
          .then(expect.fail)
          .catch(function (result) {
            // we're catching because resolvedValue does not have a json { Body }
            expect(client.getObject).to.have.been.called
            expect(getObjectDotPromise).to.have.been.called
          })
      })
      it('should call getObject and resolve with the parsed document { Body } string', function () {

        let resolvedValue = {
          Body: '{"test":1}'
        }

        let testVal: any = JSON.parse(resolvedValue.Body)
        let getObjectDotPromise = sinon.stub()
        getObjectDotPromise.returns(Promise.resolve(resolvedValue))
        // same as below using sinon-as-promised
        getObjectDotPromise.resolves(resolvedValue)
        client.getObject.returns({
          // getObject().promise() resolves .then with the 'resolvedValue' aka extractedDocument
          promise: getObjectDotPromise
        })

        return subject.getByKey(bucket, key)
          .then(function (result) {

            // put expectations here
            expect(client.getObject).to.have.been.called
            expect(client.getObject).to.be.calledOnce
            expect(getObjectDotPromise).to.have.been.called
            expect(result).to.be.a('object')
            expect(result.test).to.be.equal(testVal.test)
            expect(client.getObject).to.have.been.calledWith(sinon.match.object)
            expect(client.getObject).to.be.calledOnce

          })
      })
      it('should call getObject with Bucket, Key', function () {
        let resolvedValue = {
          Body: '{"test":1}'
        }

        let testVal: any = JSON.parse(resolvedValue.Body)
        let getObjectDotPromise = sinon.stub()
        getObjectDotPromise.returns(Promise.resolve(resolvedValue))

        // same as below using sinon-as-promised
        getObjectDotPromise.resolves(resolvedValue)

        client.getObject.returns({
          promise: getObjectDotPromise
        })
        return subject.getByKey(bucket, key)
          .then(function (result) {
            // put expectations here
            expect(client.getObject).to.have.been.called
            expect(getObjectDotPromise).to.have.been.called
            expect(result).to.be.a('object')
            expect(result.test).to.be.equal(testVal.test)
            // Check to make sure getObject was called with Bucket and Key args
            expect(client.getObject).to.have.been.calledWith(sinon.match.object)
            expect(client.getObject).to.have.been.calledWith(sinon.match.has('Bucket'))
            expect(client.getObject).to.have.been.calledWith(sinon.match.has('Key'))
          })
      })
      it('should throw if S3.getObject rejects', function () {
        let resolvedValue = new Error(Faker.random.uuid())
        let getObjectDotPromise = sinon.stub()
        getObjectDotPromise.returns(Promise.resolve(resolvedValue))
        // same as below using sinon-as-promised
        getObjectDotPromise.rejects(resolvedValue)
        client.getObject.returns({
          promise: getObjectDotPromise
        })
        return subject.getByKey(bucket, key)
          .then(expect.fail)
          .catch(function (error) {
            expect(client.getObject).to.have.been.called
            expect(getObjectDotPromise).to.have.been.called
            expect(error).to.be.equal(resolvedValue)
          })
      })
    })
    describe('storeByKey(options)', function () {

      it('should calll storeByKey', function () {
        let resolvedValue = Faker.random.uuid()
        expect(subject.storeByKey).to.be.a('function')
        client.putObject.returns({
          promise: sinon.stub().resolves(resolvedValue)
        })
        return subject.storeByKey(document, bucket, key)
          .then(result => {
            expect(client.putObject).to.have.been.called
            expect(result).to.be.eq(resolvedValue)
          })
      })

      it('should throw if S3.putObject rejects', function () {

        let resolvedValue = new Error(Faker.random.uuid())
        let putObjectDotPromise = sinon.stub()
        putObjectDotPromise.rejects(resolvedValue)

        client.putObject.returns({
          promise: putObjectDotPromise
        })
        return subject.storeByKey(document, bucket, key)
          .then(expect.fail)
          .catch(function (error) {
            // we're catching because resolvedValue is set to throw an error
            expect(client.putObject).to.have.been.called
            expect(putObjectDotPromise).to.have.been.called
            expect(error).to.be.equal(resolvedValue)
          })
      })
    })
  })
})
