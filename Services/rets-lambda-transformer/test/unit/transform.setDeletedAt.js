'use strict'
/* eslint-env mocha */
import { set_deleted_at } from 'functions'
import { expect } from 'chai'

describe('set_deleted_at', function () {
  it('should return a function', function () {
    expect(set_deleted_at).to.be.a('function')
  })

  it('should return a date for the deleted_at if closed', function (done) {
    let transform = set_deleted_at()
    transform(['closed'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      done()
    })
  })

  it('should not return a date if active', function (done) {
    let transform = set_deleted_at()
    transform(['active'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.be.undefined
      done()
    })
  })
  it('should not return a date if no status', function (done) {
    let transform = set_deleted_at()
    transform([], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(0)
      expect(values[0]).to.be.undefined
      done()
    })
  })
})
