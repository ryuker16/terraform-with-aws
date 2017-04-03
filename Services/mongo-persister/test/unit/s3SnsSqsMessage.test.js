/* eslint-env mocha */
'use strict'
const fs = require('fs')
const path = require('path')
const chai = require('chai')
const expect = chai.expect

describe('S3 > SNS > SQS Payload Tests', function () {
  let SqsBody = ''
  let SnsNotification = ''
  beforeEach(function (done) {
    fs.readFile(path.resolve(__dirname, '../../documentation/sampleS3SnsSqsMessage.json'), (err, content) => {
      if (err) return done(err)
      SqsBody = JSON.parse(content).Messages[0].Body
      SnsNotification = JSON.parse(SqsBody)
      done()
    })
  })
  it('should parse SQS Message { Body } as { Type: Notification, Message: string } aka SnsNotification', function () {
    expect(SnsNotification).to.have.property('Type', 'Notification')
    expect(SnsNotification).to.have.property('Message')
      .and.be.a('string')
  })
  describe('SQS Parse { Body } => SnsNotification, Parse { Message } ', function () {
    let SnsMessageParsed = ''
    beforeEach(function () {
      SnsMessageParsed = JSON.parse(SnsNotification.Message)
    })
    it('should have { Records: [] }', function () {
      expect(SnsMessageParsed).to.have.property('Records')
        .and.be.a('array')
    })
    describe('SnsNotification Records[] > S3EventRecordMessage', function () {
      let S3EventRecordMessage = null
      beforeEach(function () {
        S3EventRecordMessage = SnsMessageParsed.Records[0]
      })
      it('should have { Records: [] } as S3EventRecordMessage', function () {
        expect(S3EventRecordMessage).to.be.a('object')
        expect(S3EventRecordMessage).to.have.property('eventSource', 'aws:s3')
      })
      it('should have { s3: { bucket.name, object.key } }', function () {
        expect(S3EventRecordMessage).to.have.property('s3')
        expect(S3EventRecordMessage.s3).to.have.property('bucket')
          .and.have.property('name')
        expect(S3EventRecordMessage.s3).to.have.property('object')
          .and.have.property('key')
      })
    })
  })
})
