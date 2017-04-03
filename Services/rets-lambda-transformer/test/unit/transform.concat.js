'use strict'
/* eslint-env mocha */
import { concat } from 'functions'
import { expect } from 'chai'

describe('concat', function () {
  it('should return a function', function () {
    expect(concat).to.be.a('function')
  })
  it('should concat the array of 1 value', function () {
    let transform = concat({ separator: ' ' })
    transform(['Main'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('Main')
    })
  })
  it('should concat the array of 2 values with space', function () {
    let transform = concat({ separator: ' ' })
    transform(['Main', 'Street'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('Main Street')
    })
  })
  it('should concat the array of 4 values with *', function () {
    let transform = concat({ separator: '*' })
    transform(['one', 'two', 'three', 'four'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('one*two*three*four')
    })
  })
  it('should not fail if non-string values', function () {
    let transform = concat({ separator: ' ' })
    transform(['one', 4, null, 'four'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('one 4 four')
    })
  })
  it('should not fail if no valid values are given', function () {
    let transform = concat({ separator: ' ' })
    transform([null, ''], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('')
    })
  })
  it('should not fail if no values are given', function () {
    let transform = concat({ separator: ' ' })
    transform([null], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('')
    })
  })
})
