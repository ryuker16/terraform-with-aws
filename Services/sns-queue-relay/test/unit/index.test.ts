/// <reference types="mocha" />
/// <reference types="sinon-as-promised" />

import { expect } from 'chai'
import * as sinon from 'sinon'
import { handler } from '../../src'
import * as config from '../../src/config'
import * as Promise from 'bluebird'
import { SNSQueueRelay } from '../../src/lib/snsQueueRelay'
describe('index', function () {
  let relayStub: sinon.SinonStub = null
  beforeEach(function () {
    relayStub = sinon.stub(SNSQueueRelay.prototype, 'relay')
  })
  afterEach(function () {
    relayStub.restore()
  })
  it('should export handler', function () {
    expect(handler).to.be.a('function')
  })
  it('should call SNSQueueRelay.relay', function () {
    let retVal = { foo: 'bar' }
    relayStub.returns(Promise.resolve(retVal))
    return Promise.fromCallback((callback: any) => {
      handler({} as any, {} as any, callback)
    }).then(function (result) {
      expect(result).to.be.eq(retVal)
      sinon.assert.calledOnce(relayStub)
    })
  })
  it('should reject callback if SNSQueueRelay.relay rejects', function () {
    let retVal = new Error('err')
    relayStub.returns(Promise.reject(retVal))
    return Promise.fromCallback((callback: any) => {
      handler({} as any, {} as any, callback)
    }).then(expect.fail)
      .error(function (operationalError) {
        expect(operationalError.cause).to.be.eq(retVal)
        sinon.assert.calledOnce(relayStub)
      })
  })
  describe('config', function () {
    describe('getDefault', function () {
      it('should return defaultValue', function () {
        expect(config.getDefault('not included', 10)).to.be.eq(10)
        expect(config.getDefault('not included', 'abc')).to.be.eq('abc')
      })
    })
  })
})
