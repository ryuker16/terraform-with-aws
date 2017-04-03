'use strict'
/* eslint-env mocha */
import { suffix_with } from 'functions'
import { expect } from 'chai'

describe('suffix_with', function () {
  it('should return a function', function () {
    expect(suffix_with).to.be.a('function')
  })
  it('should suffix the given with the specified suffix', function () {
    let doc = {street_suffix: 'Street'}
    let transform = suffix_with({value: 'street_suffix'}, doc)
    transform(['45th'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('45th Street')
    })
  })
  it('should error if no given suffix', function () {
    let transform = suffix_with({}, {})
    transform(['45th'], (err, values) => {
      expect(err.message).to.be.equal('Attempting to suffix without valid parameters')
      expect(err).to.be.instanceOf(Error)
    })
  })
  it('should not suffix with anything if given null value', function () {
    let doc = {street_suffix: null}
    let transform = suffix_with({value: 'street_suffix'}, doc)
    transform(['45th'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('45th')
    })
  })
  it('should not suffix with anything if given undefined value', function () {
    let doc = {street_suffix: undefined}
    let transform = suffix_with({value: 'street_suffix'}, doc)
    transform(['45th'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('45th')
    })
  })
  it('should suffix with given if base is null', function () {
    let doc = {street_suffix: 'Street'}
    let transform = suffix_with({value: 'street_suffix'}, doc)
    transform([null], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('Street')
    })
  })
  it('should suffix with given if base is undefined', function () {
    let doc = {street_suffix: 'Street'}
    let transform = suffix_with({value: 'street_suffix'}, doc)
    transform([undefined], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('Street')
    })
  })
  it('should suffix nothing if both values null', function () {
    let doc = {street_suffix: undefined}
    let transform = suffix_with({value: 'street_suffix'}, doc)
    transform([null], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('')
    })
  })
})
