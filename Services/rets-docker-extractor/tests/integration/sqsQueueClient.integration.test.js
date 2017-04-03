/* eslint-env mocha */
'use strict'
const SQSQueueClient = require('src/lib/queue/sqsQueueClient').SQSQueueClient
const chai = require('chai')
const expect = chai.expect
const config = require('config')
const AWS = require('./sdk')
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
const queueUrl = config.get('importQueueUrl')
const getLogger = require('infrastructure-logging-lib').getLogger
const path = require('path')
const logger = getLogger(path.basename(__filename), 'sqsQueueClient', null, {
  streams: [{
    stream: process.stdout
  }, {
    type: 'rotating-file',
    path: path.resolve(__dirname, 'logs/', `${path.basename(__filename)}.log`),
    period: '1d', // daily rotation
    count: 3 // keep 3 back copies
  }]
})

describe('SQSQueueClient', function () {
  this.timeout(5000)
  var client
  before(function (done) {
    sqs.purgeQueue({
      QueueUrl: queueUrl
    }).promise().then(() => done(), done)
  })
  beforeEach(() => {
    client = new SQSQueueClient(sqs, queueUrl)
  })
  it('can get the last posted message', function (done) {
    var body = { foo: 'bar' }
    var params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body)
    }
    var messageId
    sqs.sendMessage(params).promise()
      .then((data) => {
        logger.info({ data }, 'sendMessage')
        messageId = data.MessageId
        return client.getMessage()
      })
      .then((msg) => {
        logger.info({ getMessage: msg }, 'getMessage')
        expect(msg.MessageId).to.be.equal(messageId)
        expect(msg.ReceiptHandle).to.be.ok
        expect(msg.Data).to.be.equal(body, 'parsed message data')
        done()
      })
      .catch(done)
  })
})
