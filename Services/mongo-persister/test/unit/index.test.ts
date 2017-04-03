/// <reference types="mocha" />
/// <reference path="../../definitions/index.d.ts" />

import { expect } from 'chai'
import * as sinon from 'sinon'
import * as Promise from 'bluebird'
import { MongoPersister } from '../../src/lib/mongoPersister'
import * as config from 'config'
import { handler } from '../../src'

describe('index', function () {
  it('should export handler', function () {
    expect(handler).to.be.a('function')
  })
  describe('handler', function () {
    let executeStub = sinon.stub()
    before(function () {
      executeStub = sinon.stub(MongoPersister.prototype, 'execute')
    })
    after(function () {
      executeStub.restore()
    })
    it('should call MongoPersister.execute', function (done) {
      executeStub.resolves({})
      let event = {} as any
      let context = {} as any
      let callback = function (err?: any) {
        sinon.assert.called(executeStub)
        done(err)
      }
      handler(event, context, callback)
    })
  })
})
