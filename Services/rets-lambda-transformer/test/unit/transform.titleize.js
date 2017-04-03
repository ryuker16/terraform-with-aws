'use strict'
/* eslint-env mocha */
import { titleize } from 'functions'
import { expect } from 'chai'

describe('titleize', function () {
  it('should return a function', function () {
    expect(titleize).to.be.a('function')
  })

  it('should not require options', function () {
    expect(titleize).to.not.throw(Error)
  })

  it('should capitalize each word in a string', function (done) {
    let transform = titleize()
    transform(['hello world'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('Hello World')
      done()
    })
  })
})
