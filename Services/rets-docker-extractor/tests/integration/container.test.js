/* eslint-env mocha */
'use strict'
const container = require('src/container')
const types = require('src/lib/types').default
const ExtractProcessor = require('src/lib/processor').ExtractProcessor

const chai = require('chai')
const expect = chai.expect

describe('container', function () {
  it('can gen Processor', function () {
    let processor = container.get(types.ExtractProcessor)
    expect(processor).to.be.instanceOf(ExtractProcessor)
    expect(processor).to.be.ok
    expect(processor.queue).to.be.ok
    expect(processor.timestampNotifier).to.be.ok
  })
})
