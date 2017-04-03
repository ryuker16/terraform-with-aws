'use strict'
/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.should()
chai.use(sinonChai)
const awsrequest = require('./awsrequest')

import { EventPublisher } from 'lib/eventPublisher'

describe('EventPublisher', function () {
  describe('publish', function () {
    let sampleMessage = { foo: 'bar' }
    let sns = null
    let pub = null

    beforeEach(function () {
      sns = sinon.stub({
        publish: (params) => { }
      })
      pub = new EventPublisher(sns)
    })

    it('should publish the message to sns', function (done) {
      sns.publish.returns(awsrequest(sinon.stub().resolves(true)))
      pub.publish('test:arn', sampleMessage).then(function () {
        expect(sns.publish).to.have.been.called
        done()
      })
        .catch(done)
    })

    it('should send to the supplied TargetArn with Message', function (done) {
      sns.publish.returns(awsrequest(sinon.stub().resolves(true)))
      pub.publish('test:arn', sampleMessage)
        .then(function (result) {
          expect(sns.publish).to.have.been.calledWith(sinon.match.has('TargetArn', 'test:arn'))
          expect(sns.publish).to.have.been.calledWith(sinon.match.has('Message', JSON.stringify(sampleMessage)))
          done()
        })
        .catch(done)
    })

    it('should throw any errors from AWS', function (done) {
      let expected = new Error()
      sns.publish.returns(awsrequest(sinon.stub().rejects(expected)))
      pub.publish('test:arn', sampleMessage)
        .catch(function (err) {
          expect(err).to.be.ok
          expect(err).to.be.equal(expected)
          done()
        })
        .catch(done)
    })
  })
})
