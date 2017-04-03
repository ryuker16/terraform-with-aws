'use strict'
/* eslint-env mocha */
import { downcase } from 'functions'
import { expect } from 'chai'

describe('downcase', function () {
  it('should return a function', function () {
    expect(downcase).to.be.a('function')
  })

  it('should not require options', function () {
    expect(downcase).to.not.throw(Error)
  })

  it('should convert the string to lowercase', function (done) {
    let transform = downcase()
    transform(['HeLLo WoRlD'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('hello world')
      done()
    })
  })
})
