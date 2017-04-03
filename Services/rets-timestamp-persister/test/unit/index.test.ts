/// <reference types="mocha" />
/// <reference types="sinon-as-promised" />

import { expect } from 'chai'
import * as sinon from 'sinon'
import { handler } from '../../src'
import * as config from '../../src/config'
import * as Promise from 'bluebird'

import { RetsTimestampPersister } from '../../src/lib/retsTimestampPersister'

describe('index', function () {
  let executeStub: sinon.SinonStub = null
  beforeEach(function () {
    executeStub = sinon.stub(RetsTimestampPersister.prototype, 'execute')
  })
  afterEach(function () {
    executeStub.restore()
  })
  it('should export handler', function () {
    expect(handler).to.be.a('function')
  })
  it('should call RetsTimestampPersister.execute', function () {
    let retVal = { foo: 'bar' }
    executeStub.returns(Promise.resolve(retVal))
    return Promise.fromCallback((callback: any) => {
      handler({} as any, {} as any, callback)
    }).then(function (result) {
      expect(result).to.be.eq(retVal)
      sinon.assert.calledOnce(executeStub)
    })
  })
  it('should reject callback if RetsTimestampPersister.execute rejects', function () {
    let retVal = new Error('err')
    executeStub.returns(Promise.reject(retVal))
    return Promise.fromCallback((callback: any) => {
      handler({} as any, {} as any, callback)
    }).then(expect.fail)
      .error(function (operationalError) {
        expect(operationalError.cause).to.be.eq(retVal)
        sinon.assert.calledOnce(executeStub)
      })
  })
  describe('config', function () {
    describe('getDefaultBool', function () {
      it('should return default falue', function () {
        expect(config.getDefaultBool('not included', false)).to.be.eq(false)
        expect(config.getDefaultBool('not included', true)).to.be.eq(true)
      })
      it('should return true/false if included in config', function () {
        expect(config.getDefaultBool('boolfalse', true)).to.be.eq(false)
        expect(config.getDefaultBool('booltrue', false)).to.be.eq(true)
        expect(config.getDefaultBool('boolinvalid', false)).to.be.eq(false)
      })
    })
    describe('getDefaultInt', function () {
      it('should return defaultValue', function () {
        expect(config.getDefaultInt('not included', 10)).to.be.eq(10)
      })
      it('should return parsed value', function () {
        expect(config.getDefaultInt('defaultint', 10)).to.be.eq(21)
      })
    })

    describe('getDefault', function () {
      it('should return defaultValue', function () {
        expect(config.getDefault('not included', 10)).to.be.eq(10)
        expect(config.getDefault('not included', 'abc')).to.be.eq('abc')
      })
    })
  })
})
