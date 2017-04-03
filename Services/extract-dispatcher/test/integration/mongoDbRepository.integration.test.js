'use strict'
/* eslint-env mocha */
const MongoDbRepository = require('src/mongoDbRepository').default
const chai = require('chai')
const expect = chai.expect
const MongoClient = require('mongodb').MongoClient
const config = require('config')
const getLogger = require('infrastructure-logging-lib').getLogger

describe('Test extraction of mongo data', function () {
  it('should establish a connection with > 0 scheduleId results', function () {
    this.timeout(15000)
    let logger = getLogger('mongo-persister', __filename)
    let repository = new MongoDbRepository(new MongoClient(), logger)
    return repository.getScheduledImports(config.get('dispatcher.scheduleId'))
      .then((result) => {
        expect(result.length).to.be.above(5)
      })
  })
})
