'use strict'
/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.should()
chai.use(sinonChai)
let Repository = require('lib/documentRepo').DocumentRepo
const awsrequest = require('./awsrequest')

describe('documentRepo', function () {
  let s3
  let repo
  let logger = null
  beforeEach(function () {
    s3 = sinon.stub({
      getObject: () => { },
      putObject: () => { }
    })
    logger = sinon.stub({
      error: () => { }
    })
    repo = new Repository(s3, logger)
  })
  describe('getExtractedDocument', function () {
    beforeEach(function () { })
    it('should make a s3 getObject request', function (done) {
      s3.getObject.returns(awsrequest(sinon.stub().resolves({ Body: JSON.stringify(logger) })))
      repo.getExtractedDocument()
        .then(function (data) {
          expect(s3.getObject).to.have.been.called
          done()
        }).catch(done)
    })
    it('should throw SyntaxError if Body cannot be parsed as a string', function (done) {
      s3.getObject.returns(awsrequest(sinon.stub().resolves({ Body: new Repository() })))
      repo.getExtractedDocument()
        .catch(function (err) {
          expect(err).to.be.instanceOf(SyntaxError)
          done()
        })
    })
  })
  describe('storeTransformedDocument', function () {
    it('should make a s3 put', function (done) {
      s3.putObject.returns(awsrequest(sinon.stub().resolves(true)))
      repo.storeTransformedDocument({ 'foo': 'bar' }).then(function (data) {
        expect(s3.putObject).to.have.been.called
        done()
      })
    })
    it('sould catch and throw error if put fails', function (done) {
      s3.putObject.returns(awsrequest(sinon.stub().rejects(new Error('Error'))))
      repo.storeTransformedDocument({ 'foo': 'bar' })
      .then(expect.fail)
      .catch(function (err) {
        expect(err).to.have.been.thrown
        expect(s3.putObject).to.have.been.called
        done()
      })
    })
  })
})
