/// <reference types="sinon-chai" />

import { PropertyDocumentPersister } from '../../../src/lib/propertyDocumentPersister'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as config from 'config'
import { ObjectID } from 'mongodb'
import * as Faker from 'faker'

describe('PropertyDocumentPersister', function () {
  let subject: PropertyDocumentPersister = null
  let logger: any = null
  let testDoc: any = {}
  beforeEach(function () {
    const fn = () => true
    logger = sinon.stub({ audit: fn })
    subject = new PropertyDocumentPersister(logger)
    testDoc = {}
  })
  it('should export three functions', function () {
    expect(PropertyDocumentPersister.prototype.getCollectionName).to.be.a('function')
    expect(PropertyDocumentPersister.prototype.generateIdHexString).to.be.a('function')
    expect(PropertyDocumentPersister.prototype.isValidDocument).to.be.a('function')
  })
  describe('getCollectionName', function () {
    it('should return a collection name from config perister.propertyCollection', function () {
      expect(subject.getCollectionName()).to.be.equal(config.get('persister.propertyCollection'))
    })
  })
  describe('generateIdHexString', function () {
    it('should return the doc._id if it exists', function () {
      testDoc._id = '123'
      expect(subject.generateIdHexString(testDoc)).to.be.equal('123')
    })
    it('should generate a hash id', function () {
      expect(subject.generateIdHexString(testDoc)).to.be.a('string')
    })
  })
  describe('isValidDocument', function () {
    it('should return true if import_id and mls_id', function () {
      testDoc._id = '123'
      testDoc.import_id = '12'
      testDoc.mls_id = '3'
      expect(subject.isValidDocument(testDoc)).to.be.true
    })
    it('should return true if import_id and feed_id', function () {
      testDoc._id = '123'
      testDoc.import_id = '12'
      testDoc.feed_id = '3'
      expect(subject.isValidDocument(testDoc)).to.be.true
    })
    it('should return true if import_id, mls_id, and feed_id', function () {
      testDoc._id = '123'
      testDoc.import_id = '12'
      testDoc.feed_id = '3'
      testDoc.mls_id = '3'
      expect(subject.isValidDocument(testDoc)).to.be.true
    })
    it('should return false if no import_id', function () {
      testDoc._id = '3'
      testDoc.mls_id = '3'
      logger.audit.returns(true)
      expect(subject.isValidDocument(testDoc)).to.be.false
      expect(logger.audit).to.have.been.called
    })
    it('should return false if import_id and no mls_id', function () {
      testDoc._id = 'a1b2c3'
      logger.audit.returns(true)
      expect(subject.isValidDocument(testDoc)).to.be.false
      expect(logger.audit).to.have.been.called
    })
  })
  describe('getFilter', function () {
    it('should return { import_id, feed_id }', function () {
      let oid = new ObjectID()
      testDoc.import_id = oid
      testDoc.feed_id = Faker.random.uuid
      let result = subject.getFilter(testDoc)
      expect(result).to.have.property('feed_id', testDoc.feed_id)
      expect(result).to.have.property('import_id', oid)
    })
    it('should return { import_id, feed_id } and use strings', function () {
      let oid = new ObjectID()
      testDoc.import_id = oid.toHexString()
      testDoc.feed_id = Faker.random.uuid
      let result = subject.getFilter(testDoc)
      expect(result).to.have.property('feed_id', testDoc.feed_id)
      expect(oid.equals(testDoc.import_id), 'import_id ObjectID equals').to.be.ok
    })
  })
  describe('getUpdate', function () {
    it('should return { $set: document }', function () {
      let oid = new ObjectID()
      testDoc.import_id = oid
      testDoc.feed_id = Faker.random.uuid
      let result = subject.getUpdate(testDoc)
      expect(result).to.have.property('$set', testDoc)
    })
    it('should not $set with _id return { $set: document }', function () {
      let oid = new ObjectID()
      testDoc._id = Faker.random.uuid()
      testDoc.import_id = oid
      testDoc.feed_id = Faker.random.uuid
      let result = subject.getUpdate(testDoc)
      expect(result['$set']).to.not.have.property('_id')
    })
  })
})
