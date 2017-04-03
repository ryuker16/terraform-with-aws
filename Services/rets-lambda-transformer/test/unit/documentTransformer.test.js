'use strict'
/* eslint-env mocha */
import { DocumentTransformer } from 'lib/documentTransformer'
import { TransformationError } from 'lib/transformationErrors'
import { expect } from 'chai'
import * as sinon from 'sinon'

describe('DocumentTransformer', function (done) {
  let mockLogger = null
  beforeEach(function () {
    mockLogger = sinon.stub({
      boundary: () => { },
      error: () => { },
      telemetry: () => { },
      audit: () => { }
    })
  })

  describe('#set()', function () {
    it('should set an attribute value', function () {
      let doc = new DocumentTransformer()
      doc.set('testa', 3)
      expect(doc.attributes.testa = 3)
    })
    it('should set a dot deep attribute value', function () {
      let doc = new DocumentTransformer()
      doc.set('test.a.b.c', 3)
      expect(doc.attributes['test.a.b.c'] = 3)
    })
  })

  describe('#transform()', function () {
    it('should return a new document', function () {
      const mlsData = {
        'PHOTOCOUNT': '4'
      }

      const mappings = [
        {
          source: ['PHOTOCOUNT'],
          target: ['total_photos'],
          type: 'number'
        }
      ]

      let doc = new DocumentTransformer(mlsData)

      return doc.transform(mappings)
        .then(newDoc => {
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(newDoc).to.not.equal(doc)
        })
    })

    it('should return a promise', function () {
      let doc = new DocumentTransformer({ name: 'John Doe' })
      let promise = doc.transform([])
      expect(promise.then).to.be.a('function')
      expect(promise.catch).to.be.a('function')
    })

    it('should execute multiple transformations on a single field', function () {
      const mlsData = {
        'STREETNAME': '123 sesame st.',
        'STREETSUFFIX': 'Unit 999'
      }

      const mappings = [
        {
          source: ['STREETNAME'],
          type: 'string',
          target: ['location.street_name'],
          fn: [
            {
              name: 'suffix_with',
              arguments: {
                value: 'STREETSUFFIX'
              }
            },
            {
              name: 'titleize'
            }
          ]
        }
      ]

      let doc = new DocumentTransformer(mlsData, mockLogger)

      return doc.transform(mappings).then(newDoc => {
        expect(Object.keys(newDoc.attributes).length).to.equal(1)
        expect(newDoc.attributes['location.street_name']).to.equal('123 Sesame St. Unit 999')
      })
    })

    it("should ignore fields that don't exist", function () {
      const mlsData = {
        'STREETNAME': '123 Sesame St.'
      }

      const mappings = [
        {
          source: ['PHOTOCOUNT'],
          target: ['total_photos'],
          type: 'number'
        }
      ]

      let doc = new DocumentTransformer(mlsData, mockLogger)
      return doc.transform(mappings)
        .then((newDoc) => {
          expect(Object.keys(newDoc.attributes).length).to.equal(0)
        })
    })

    it('should only carry over fields with mappings', function () {
      const mlsData = {
        'PHOTOCOUNT': '4',
        'STREETNAME': '123 Sesame St.'
      }

      const mappings = [
        {
          source: ['PHOTOCOUNT'],
          target: ['total_photos'],
          type: 'number'
        }
      ]

      let doc = new DocumentTransformer(mlsData, mockLogger)

      return doc.transform(mappings)
        .then((newDoc) => {
          expect(Object.keys(newDoc.attributes).length).to.equal(1)
          expect(newDoc.attributes.total_photos).to.equal('4')
        })
    })

    it('should TransformationError when mapping fn is not defined', function () {
      const mlsData = { 'PHOTOCOUNT': '4' }

      const mappings = [
        {
          source: ['PHOTOCOUNT'],
          target: ['total_photos'],
          type: 'number',
          fn: [
            {
              name: 'not_a_defined_function'
            }
          ]
        }
      ]

      let doc = new DocumentTransformer(mlsData)

      return doc.transform(mappings)
        .then(expect.fail)
        .catch(TransformationError, (err) => {
          expect(err).to.be.instanceOf(TransformationError)
        })
        .catch(expect.fail)
    })

    it('should set status according to sold_statuses', function () {
      const mlsData = { 'ABC': 'Sold' }

      const mappings = [
        {
          source: ['ABC'],
          target: ['cur_data.status', 'status'],
          fn: [
            {
              name: 'set_status',
              arguments: {
                sold_statuses: ['Sold']
              }
            }
          ]
        }
      ]

      let doc = new DocumentTransformer(mlsData)

      return doc.transform(mappings)
        .then((newDoc) => {
          expect(Object.keys(newDoc.attributes).length).to.equal(2)
          console.log(JSON.stringify(newDoc.attributes))
          expect(newDoc.attributes.status).to.equal('closed')
          expect(newDoc.attributes['cur_data.status']).to.equal('Sold')
        })
    })
    it('should set cur_data.status', function () {
      const mlsData = { 'ABC': 'Sold' }

      const mappings = [
        {
          source: ['ABC'],
          target: ['cur_data.status'],
          fn: [
            {
              name: 'set_status'
            }
          ]
        }
      ]

      let doc = new DocumentTransformer(mlsData)

      return doc.transform(mappings)
        .then((newDoc) => {
          expect(Object.keys(newDoc.attributes).length).to.equal(1)
          console.log(JSON.stringify(newDoc.attributes))
          expect(newDoc.attributes['cur_data.status']).to.equal('Sold')
        })
    })

    describe('#enrich', function () {
      it('should return a promise', function () {
        let doc = new DocumentTransformer({ name: 'John Doe' }, mockLogger)
        let promise = doc.enrich([])

        expect(promise.then).to.be.a('function')
        expect(promise.catch).to.be.a('function')
      })

      it('should return the same document', function () {
        const mlsData = {
          'PHOTOCOUNT': '4'
        }
        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(newDoc).to.equal(doc)
        })
      })

      it('should convert a country to a code', function () {
        const mlsData = {
          'location.country': 'United States of America'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)
        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(1)
          expect(attributes['location.country']).to.equal('us')
        })
      })

      it('should convert a state to a code', function () {
        const mlsData = {
          'location.region': 'Massachusetts'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(1)
          expect(attributes['location.region']).to.equal('MA')
        })
      })

      it('should convert phone numbers', function () {
        const mlsData = {
          'agency_data.phone': '888-888-8888',
          'rets.aphone': '18888888888',
          'rets.ophone': '(888)888-8888'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(3)
          expect(attributes['agency_data.phone']).to.equal('+18888888888')
          expect(attributes['rets.aphone']).to.equal('18888888888')
          expect(attributes['rets.ophone']).to.equal('(888)888-8888')
        })
      })

      it('should build the full address from address fields', function () {
        const mlsData = {
          'location.street_direction': 'Northeast',
          'location.street_name': 'Seventh Street',
          'location.street_number': '15'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          // console.log(attributes)
          expect(Object.keys(attributes).length).to.equal(4)
          expect(attributes['location.address']).to.equal('15 Northeast Seventh Street')
        })
      })
      it('should reformat the images', function () {
        const mlsData = {
          'images': [{ headerInfo: { location: 'url', objectId: '0' } }, { headerInfo: { location: 'url1.com', objectId: '1' } }]
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(1)
          expect(attributes['images']).to.be.deep.equal([{ original_url: 'url', order: '0', caption: '' }, { original_url: 'url1.com', order: '1', caption: '' }])
        })
      })
      it('should set mark deleted at for closed', function() {
        const mlsData = {
          'status': 'closed',
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(2)
          expect(attributes['status']).to.be.equal('closed')
          expect(attributes['deleted_at']).to.exist
        })
      })
      it('should not mark deleted_at for active', function() {
        const mlsData = {
          'status': 'active'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(1)
          expect(attributes['status']).to.be.equal('active')
          expect(attributes['deleted_at']).to.not.exist
        })
      })
      it('should not error and should not fail if status does not exist', function() {
        const mlsData = {
        }
        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(Object.keys(attributes).length).to.equal(0)
          expect(attributes['status']).to.not.exist
          expect(attributes['deleted_at']).to.not.exist
        })
      })
    })

    describe('#createMappingTaskGenerator', function () {
      it("should convert a value's type after running functions", function (done) {
        const mlsData = {
          'tens': '8',
          'ones': '1'
        }

        const mapping = {
          source: ['tens', 'ones'],
          target: ['baseten'],
          fn: [{ name: 'concat', arguments: { separator: '' } }],
          type: 'float'
        }

        let doc = new DocumentTransformer({})

        let task = doc.createMappingTaskGenerator(mlsData)(mapping)

        task(function (err, result) {
          expect(err).to.not.be.ok
          expect(result['baseten']).to.be.a('number')
          expect(result['baseten']).to.equal(81)
          done()
        })
      })

      it('should convert a source a value to a float', function (done) {
        const mlsData = {
          'type.float': '8.8'
        }

        const mapping = {
          source: ['type.float'],
          target: ['type.float'],
          type: 'float'
        }

        let doc = new DocumentTransformer({}, mockLogger)

        let task = doc.createMappingTaskGenerator(mlsData)(mapping)

        task(function (err, result) {
          expect(err).to.not.be.ok
          expect(result['type.float']).to.be.a('number')
          expect(result['type.float']).to.equal(8.8)
          done(err)
        })
      })

      it('should convert a source a value to an integer', function (done) {
        const mlsData = {
          'type.int': '8.8'
        }

        const mapping = {
          source: ['type.int'],
          target: ['type.int'],
          type: 'int'
        }

        let doc = new DocumentTransformer({}, mockLogger)

        let task = doc.createMappingTaskGenerator(mlsData)(mapping)

        task(function (err, result) {
          expect(err).to.not.be.ok
          expect(result['type.int']).to.be.a('number')
          expect(result['type.int']).to.equal(8)
          done(err)
        })
      })

      it('should convert a source a value to a boolean', function (done) {
        const mlsData = {
          'type.boolean': 'true'
        }

        const mapping = {
          source: ['type.boolean'],
          target: ['type.boolean'],
          type: 'boolean'
        }

        let doc = new DocumentTransformer({}, mockLogger)

        let task = doc.createMappingTaskGenerator(mlsData)(mapping)

        task(function (err, result) {
          expect(err).to.not.be.ok
          expect(result['type.boolean']).to.be.a('boolean')
          expect(result['type.boolean']).to.equal(true)
          done(err)
        })
      })

      it('should move mls_id to rets.mls_id', function () {
        const mlsData = {
          'mls_id': '12345'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(attributes['rets.mls_id']).to.equal('12345')
        })
      })

      it('should move office.id to rets.oid', function () {
        const mlsData = {
          'office.id': 'the_office'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(attributes['rets.oid']).to.equal('the_office')
        })
      })

      it('should move agent.id to rets.aid', function () {
        const mlsData = {
          'agent.id': 'the_agent'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(attributes['rets.aid']).to.equal('the_agent')
        })
      })

      it('should move office.name to rets.oname', function () {
        const mlsData = {
          'office.name': 'dunder mifflin'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(attributes['rets.oname']).to.equal('dunder mifflin')
        })
      })

      it('should move agent.name to rets.aname', function () {
        const mlsData = {
          'agent.name': 'jim halpert'
        }

        let doc = new DocumentTransformer(mlsData, mockLogger)

        return doc.enrich().then(newDoc => {
          const attributes = newDoc.attributes
          expect(newDoc).to.be.an.instanceof(DocumentTransformer)
          expect(attributes['rets.aname']).to.equal('jim halpert')
        })
      })
    })
  })
})
