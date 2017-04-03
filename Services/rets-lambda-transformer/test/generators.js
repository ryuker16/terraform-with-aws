'use strict'
const _ = require('lodash')
const Faker = require('faker')

const genRetsDocumentExtracted = function (propertyCount) {
  let rde = {
    context: {
      correlationID: Faker.random.uuid()
    },
    purchaseType: Faker.name.findName(),
    config: {
      importId: Faker.random.uuid(),
      providerId: Faker.random.uuid()
    },
    retsDocumentBody: {},
    retsDocumentImages: [],
    transformManifest: {
      listing: []
    }
  }
  let sources = Faker.lorem.words(propertyCount).split(' ')
  let targets = Faker.lorem.words(propertyCount).split(' ')
  console.log('sources', sources, 'targets', targets)
  _.times(propertyCount, function (n) {
    // create a fake property and a destination for it
    let source = [`${sources[n]}${n}`]
    let target = [`${targets[n]}${n}`]
    let type = 'string'
    rde.retsDocumentBody[`${sources[n]}${n}`] = Faker.name.findName()
    rde.transformManifest.listing.push({
      source,
      target,
      type,
      fn: [{
        name: 'downcase'
      }]
    })
    rde.retsDocumentImages.push({ contentId: Faker.random.uuid() })
  })
  return rde
}
module.exports.genRetsDocumentExtracted = genRetsDocumentExtracted

const genRetsDocumentExtractedFirehoseRecords = function (recordCount, propertyCount) {
  return {
    records: _.times(recordCount, (n) => genRetsDocumentExtracted(propertyCount))
      .map(function (rde) {
        return {
          recordId: Faker.random.uuid(),
          data: new Buffer(JSON.stringify(rde)).toString('base64')
        }
      })
  }
}
module.exports.genRetsDocumentExtractedFirehoseRecords = genRetsDocumentExtractedFirehoseRecords
