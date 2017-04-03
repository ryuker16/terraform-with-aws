'use strict'
/* eslint-env mocha */
import { split_sqft_range } from 'functions'
import { expect } from 'chai'

describe('splitRange', function () {
  it('should return a function', function () {
    expect(split_sqft_range).to.be.a('function')
  })
  it('should split the range', function (done) {
    let transform = split_sqft_range()
    transform(['10 - 20'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(3)
      expect(values[0]).to.equal(10)
      expect(values[1]).to.equal(20)
      expect(values[2]).to.equal(15)
      done()
    })
  })
  it('should return [] without supplied values', function (done) {
    let transform = split_sqft_range()
    transform([], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values).to.have.lengthOf(0)
      done()
    })
  })
  it('should return just min without a value to split', function (done) {
    let transform = split_sqft_range()
    transform(['10'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values).to.have.lengthOf(3)
      expect(values[0]).to.be.equal(10)
      done()
    })
  })
  it('should return array of NaN if given a string', function (done) {
    let transform = split_sqft_range()
    transform(['null'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values).to.have.lengthOf(3)
      done()
    })
  })
  it('should return array of NaN if given null', function (done) {
    let transform = split_sqft_range()
    transform([null], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values).to.have.lengthOf(3)
      done()
    })
  })
})
