'use strict'
/* eslint-env mocha */
const path = require('path')
const fs = require('fs')
const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
chai.should()

describe('Doc against test_data', function () {
  let mockEvent = null
  let mockMsg = null

  let mockLogger = {
    boundary: () => {
    },
    audit: () => {
    }
  }

  beforeEach(function () {
    mockEvent = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/test_event.json')))
    mockMsg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/test_message.json')))
    mockEvent['Records'][0]['Sns']['Message'] = JSON.stringify(mockMsg)
  })

  it('should have a message mocked', function () {
    expect(mockEvent).to.be.ok
    expect(mockEvent['Records'][0]['Sns']['Message']).to.be.a('string')
  })

  it('should map a document and hydrate', () => {
    let DocumentTransformer = require('lib/documentTransformer').DocumentTransformer

    let mappings = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/test_mappings.json')))
    let document = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/test_document.json')))
    let canonical = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/test_canonical_transformed.json')))

    let doc = new DocumentTransformer(document, mockLogger)

    return doc.transform(mappings)
      .then((newDoc) => {
        return newDoc.enrich()
      })
      .then((enriched) => {
        let result = enriched.hydrate()
        console.log(JSON.stringify(result))
        assert.deepEqual(result.cur_data, canonical.cur_data, 'cur_data should match')
        assert.deepEqual(result.rets, canonical.rets, 'rets should match')
        assert.deepEqual(result.uncur_data, canonical.uncur_data, 'uncur_data should match')
      })
  })
})
