'use strict'
/* eslint-env mocha */
const index = require('../../dist/index')
const chai = require('chai')
require('sinon-as-promised')
const expect = chai.expect
chai.should()
const Faker = require('faker')
const Promise = require('bluebird')
const async = require('async')
const _ = require('lodash')
const genRetsDocumentExtractedFirehoseRecords = require('../generators').genRetsDocumentExtractedFirehoseRecords

describe('firehosehandler', function () {
  it('should process records with an avgDuration per record under 20 ms', function (done) {
    let times = Faker.random.number({ min: 1, max: 5 })
    let timeout = 1000 * 60 * 4
    this.timeout(timeout * times)
    console.log(`running test ${times} times`)
    async.timesSeries(times, function (time, cb) {
      let randomCount = Faker.random.number({ min: 100, max: 1000 })
      let propertyCount = Faker.random.number({ min: 50, max: 100 })
      // generate randomCount of properties
      let event = genRetsDocumentExtractedFirehoseRecords(randomCount, propertyCount)
      console.log(`transforming ${randomCount} records with ${propertyCount} properties each`)
      let then = process.hrtime()
      return Promise.fromCallback(callback => {
        index.firehosehandler(event, {}, callback)
      }).timeout(timeout)
        .then(function (result) {
          let duration = process.hrtime(then)
          let avgDurationMs = (duration[0] * 1e3 + duration[1] / 1e6) / randomCount
          console.log({ duration, avgDurationMs, randomCount, time })
          expect(result.records).to.have.lengthOf(randomCount)
          _.times(1, function (n) {
            console.log(
              'record',
              result.records[n].recordId)
          })
          expect(avgDurationMs, 'avgDuration for transformation').to.be.at.most(100)
        })
        .asCallback(cb)
    }, done)
  })
})
