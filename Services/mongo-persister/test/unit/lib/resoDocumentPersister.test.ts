/// <reference types="sinon-chai" />
/*
*  This test requires a mongod instance running on localhost:27017
*/

import { ResoType } from 'etl'
import * as _ from 'lodash'
import { ILogger } from 'infrastructure-logging-lib'
import { ResoDocumentPersister, IStoreResponse } from '../../../src/lib/resoDocumentPersister'
import { ObjectID } from 'mongodb'
import * as chai from 'chai'
const expect = chai.expect
import * as sinon from 'sinon'
import * as sinonChai from 'sinon-chai'
// signals chai to adopt sinon expectations
chai.use(sinonChai)
// signals sinon to extend with resolves/rejects
import * as Faker from 'faker'

let resoDocumentPersister: ResoDocumentPersister<any> = null

// extend ResoDocumentPersister class and provide implementations for abstract functions
export class ResoDocumentPersisterTest<T> extends ResoDocumentPersister<T> {

  resoType: ResoType

  constructor(logger: ILogger) {
    super(logger)
  }

  getFilter(doc: T) {
    return { _id: _.get(doc, '_id') }
  }

  getUpdate(doc: T) {
    return doc
  }

  getCollectionName() {
    // function isn't implemented in abstract class, so simply return string for testing purposes
    return 'testCollection'
  }
  isValidDocument(doc: T) {
    // function isn't implemented in abstract class, so simply return true for testing purposes
    return true
  }
  generateIdHexString(doc: T) {
    // function isn't implemented in abstract class, so simply return string for testing purposes
    return '0x1e904cd76f75a84e3ba10L'
  }

}

describe('ResoDocumentPersister', function () {

  let logger: any = null
  let db: any = null
  let collectionStub: any = null
  let updateOneStub: any = null
  let initializeUnorderedBulkOpStub: sinon.SinonStub = null
  let findStub = null

  describe('getIdString', function () {
    it('should return ObjectId hexString', function () {
      let oid = new ObjectID()
      let result = ResoDocumentPersister.objectIDToString(oid)
      expect(result).to.be.eq(oid.toHexString())
    })
    it('should return { $oid } string', function () {
      let oid = { $oid: Faker.random.uuid() }
      let result = ResoDocumentPersister.objectIDToString(oid)
      expect(result).to.be.eq(oid.$oid)
    })
    it('should return blank without { $oid } string', function () {
      let oid = { $oid: null as null }
      let result = ResoDocumentPersister.objectIDToString(oid)
      expect(result).not.to.be.ok
    })
  })
  describe('parseObjectID', function () {
    it('should return an already ObjectId', function () {
      let oid = new ObjectID()
      let result = ResoDocumentPersister.parseObjectID(oid)
      expect(result).to.be.eq(oid)
    })
    it('should return { $oid } string ObjectID', function () {
      let expected = new ObjectID()
      let oid = { $oid: expected.toHexString() }
      let result = ResoDocumentPersister.parseObjectID(oid)
      expect(result.equals(expected)).to.be.ok
    })
    it('should return ObjectID of passed in string', function () {
      let expected = new ObjectID()
      let result = ResoDocumentPersister.parseObjectID(expected.toString())
      expect(result.equals(expected)).to.be.ok
    })
  })

  describe('methods', function () {

    beforeEach(function () {

      logger = sinon.stub({
        audit: _.noop,
        error: _.noop
      })

      updateOneStub = sinon.stub()
      collectionStub = sinon.stub()
      db = {
        collection: collectionStub
      }

      resoDocumentPersister = new ResoDocumentPersisterTest<any>(logger)

    })

    it('should export five functions from abstract class', function () {
      expect(ResoDocumentPersisterTest.prototype.generateIdHexString).to.be.a('function')
      expect(ResoDocumentPersisterTest.prototype.getCollectionName).to.be.a('function')
      expect(ResoDocumentPersisterTest.prototype.isValidDocument).to.be.a('function')
      expect(ResoDocumentPersisterTest.prototype.upsertOneResoDoc).to.be.a('function')
      expect(ResoDocumentPersisterTest.prototype.upsertBatchResoDocs).to.be.a('function')
    })

    it('should export five functions from extended class', function () {
      expect(resoDocumentPersister.generateIdHexString).to.be.a('function')
      expect(resoDocumentPersister.getCollectionName).to.be.a('function')
      expect(resoDocumentPersister.isValidDocument).to.be.a('function')
      expect(resoDocumentPersister.upsertOneResoDoc).to.be.a('function')
      expect(resoDocumentPersister.upsertBatchResoDocs).to.be.a('function')
    })

    describe('upsertOneResoDoc(options)', function () {

      it('upsertOneResoDoc method should return a modified count of 1 if document is valid', function () {

        let document = {
          firstName: Faker.name.firstName(),
          last_name: Faker.name.lastName(),
          company: Faker.company.companyName()
        }

        let resolvedValue = {
          modifiedCount: Faker.random.number(),
          upsertedCount: 0
        }

        resoDocumentPersister.isValidDocument = sinon.stub().returns(true)

        collectionStub.returns({ updateOne: updateOneStub.returns(Promise.resolve(resolvedValue)) })

        let collectionName = Faker.name.firstName()
        // return Promse to test
        return resoDocumentPersister.upsertOneResoDoc(document, db, collectionName)
          .then(function (result) {
            // place expectations here
            expect(result.modifiedCount).to.be.equal(resolvedValue.modifiedCount)
            expect(result.upsertedCount).to.be.equal(0)
            expect(updateOneStub).to.have.been.called
            expect(collectionStub, 'db.collection(collectionName)').to.have.been.calledWith(collectionName)
          })
      })

      it('upsertOneResoDoc method should return a modified count of 0 if document is not valid', function () {

        let document = {
          firstName: Faker.name.firstName(),
          last_name: Faker.name.lastName(),
          company: Faker.company.companyName()
        }

        let resolvedValue = {
          modifiedCount: 0,
          upsertedCount: 0
        }

        resoDocumentPersister.isValidDocument = sinon.stub().returns(false)

        collectionStub.returns({
          updateOne: updateOneStub.returns(Promise.resolve(resolvedValue))
        })

        // return Promse to test
        return resoDocumentPersister.upsertOneResoDoc(document, db)
          .then(function (result) {
            // place expectations here
            expect(result.modifiedCount).to.be.equal(0)
            expect(result.upsertedCount).to.be.equal(0)
            expect(updateOneStub).to.not.have.been.called
          })
      })
    }) // end upsertOneResoDoc

    describe('upsertBatchResoDocs(options)', function () {
      let executeStub = sinon.stub()
      let document1: any = null
      let document2: any = null
      let expectedError: Error = null
      beforeEach(function () {
        collectionStub = sinon.stub()
        updateOneStub = sinon.stub()
        findStub = sinon.stub()
        executeStub = sinon.stub()
        initializeUnorderedBulkOpStub = sinon.stub()
        db = {
          collection: collectionStub.returns({
            initializeUnorderedBulkOp: initializeUnorderedBulkOpStub.returns({
              find: findStub.returns({
                upsert: sinon.stub().returns({
                  updateOne: updateOneStub
                })
              }),
              execute: executeStub
            })
          })
        }
        // create new instance of ResoDocumentPersisterTest
        resoDocumentPersister = new ResoDocumentPersisterTest<any>(logger)
        document1 = {
          firstName: Faker.name.firstName(),
          last_name: Faker.name.lastName(),
          company: Faker.company.companyName()
        }

        document2 = {
          firstName: Faker.name.firstName(),
          last_name: Faker.name.lastName(),
          company: Faker.company.companyName()
        }
        expectedError = new Error(Faker.random.uuid())
      })

      it('upsertBatchResoDocs should call initializeUnorderedBulkOp and return modified count of 2 if documents are valid', function () {
        let documents = [document1, document2]
        let lenDocs = documents.length
        let resolvedValue = {
          nModified: Faker.random.number(),
          nUpserted: 0
        }
        executeStub.returns(Promise.resolve(resolvedValue))
        resoDocumentPersister.isValidDocument = sinon.stub().returns(true)
        return resoDocumentPersister.upsertBatchResoDocs.call(resoDocumentPersister, documents, db)
          .then(function (result: IStoreResponse) {
            // assert that number of docs modified equals number of docs upserted
            expect(result.modifiedCount).to.be.equal(resolvedValue.nModified)
            // assert that replaceOne has been called twice
            expect(updateOneStub).to.have.been.callCount(lenDocs)
          })
      })

      it('upsertBatchResoDocs should use the collectionName from the method args in db.Collection', function () {
        let documents = [document1, document2]
        let lenDocs = documents.length
        let resolvedValue = {
          nModified: Faker.random.number(),
          nUpserted: 0
        }
        executeStub.rejects(expectedError)
        resoDocumentPersister.isValidDocument = sinon.stub().returns(true)
        let collectionName = Faker.name.firstName()
        return resoDocumentPersister.upsertBatchResoDocs.call(resoDocumentPersister, documents, db, collectionName)
          .then(expect.fail)
          .catch((err: Error) => {
            expect(err).to.be.eq(expectedError)
            // assert that number of docs modified equals number of docs upserted
            expect(collectionStub, 'db.collection(collectionName)').to.have.been.calledWith(collectionName)
          })
      })

      it('upsertBatchResoDocs should NOT call initializeUnorderedBulkOp and return modified count of 0 if documents are invalid', function () {
        let documents = [document1, document2]

        let resolvedValue = {
          nModified: 0,
          nUpserted: 0
        }
        executeStub.returns(Promise.resolve(resolvedValue))

        // assert that docs are invalid
        resoDocumentPersister.isValidDocument = sinon.stub().returns(false)

        return resoDocumentPersister.upsertBatchResoDocs.call(resoDocumentPersister, documents, db)
          .then(function (result: IStoreResponse) {
            expect(result.modifiedCount).to.be.equal(0)
            expect(updateOneStub).not.to.have.been.called
          })
      })

      it('upsertBatchResoDocs should call not initializeUnorderedBulkOp and return modified count of 0 if documents array is empty', function () {
        let documents: any[] = []
        resoDocumentPersister.isValidDocument = sinon.stub().returns(true)
        let resolvedValue = {
          nModified: 0,
          nUpserted: 0
        }

        return resoDocumentPersister.upsertBatchResoDocs.call(resoDocumentPersister, documents, db)
          .then(function (result: IStoreResponse) {
            expect(result.modifiedCount).to.be.equal(0)
            expect(result.upsertedCount).to.be.equal(0)
            expect(initializeUnorderedBulkOpStub).to.not.have.been.called
            expect(updateOneStub).to.not.have.been.called
          })

      })

      it('upsertBatchResoDocs should call initializeUnorderedBulkOp and n times for each documents in array', function () {
        let documents = [document1, document2]
        let lenDocs = documents.length
        resoDocumentPersister.isValidDocument = sinon.stub().returns(true)
        let resolvedValue = {
          nModified: 0,
          nUpserted: 0
        }
        executeStub.returns(Promise.resolve(resolvedValue))
        return resoDocumentPersister.upsertBatchResoDocs.call(resoDocumentPersister, documents, db)
          .then(function (result: IStoreResponse) {
            // place expectations here
            expect(result.modifiedCount).to.be.equal(0)
            expect(result.upsertedCount).to.be.equal(0)
            expect(initializeUnorderedBulkOpStub).to.have.been.called
            expect(updateOneStub).to.have.callCount(lenDocs)
          })
      })
    }) // end upsertBatchResoDocs
  })
})
