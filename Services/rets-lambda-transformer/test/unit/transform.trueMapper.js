'use strict'
/* eslint-env mocha */
import { true_mapper } from 'functions'
import { expect } from 'chai'

describe('true_mapper', function () {
  it('should return a function', function () {
    expect(true_mapper).to.be.a('function')
  })
  it('should return true if the given value is the mls true value', function () {
    let transform = true_mapper({ value: 'Y' })
    transform(['Y', 'y', 'N', 'n', 'Darth Plagueis the Wise'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values[0]).to.be.true
      expect(values[1]).to.be.true
      expect(values[2]).to.be.false
      expect(values[3]).to.be.false
      expect(values[4]).to.be.false
    })
  })
})
