/* eslint-env mocha */

var handler = require('src/index').handler
var config = require('config')
var expect = require('chai').expect
var Promise = require('bluebird')
var Faker = require('faker')

describe('index.handler', function () {
  it('should run and callback with successCount > 0', function () {
    this.timeout(30000)
    var awsRequestId = Faker.random.uuid()
    
    return Promise.fromCallback(function (callback) {
      handler(
        {
          'dispatcher': {
            'scheduleId': config.get('dispatcher.scheduleId'),
            'queueUrl': config.get('dispatcher.queueUrl')
          },
          debug: true
        },
        {
          functionName: __filename,
          getRemainingTimeInMillis: () => 30000,
          awsRequestId
        },
        callback)
    }).then(data => {
      console.log('data', data)
      console.log('correlationID', awsRequestId)
      expect(data.successCount).to.be.above(0)
    })
  })
})
