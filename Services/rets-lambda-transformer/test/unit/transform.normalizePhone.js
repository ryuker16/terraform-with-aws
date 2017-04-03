'use strict'
/* eslint-env mocha */
import { normalize_phone } from 'functions'
import { expect } from 'chai'

describe('normalizePhone', function () {
  it('should return a function', function () {
    expect(normalize_phone).to.be.a('function')
  })
  it('should normalize the 10 digit phone number', function () {
    let transform = normalize_phone()
    transform(['(123) 456-7890'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('+11234567890')
    })
  })
  it('should normalize the 11 digit phone number', function () {
    let transform = normalize_phone()
    transform(['1 (123) 456-7890'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('+11234567890')
    })
  })
  it('should throw out an invalid number', function () {
    let transform = normalize_phone()
    transform(['(12) 456-7890'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('')
    })
  })
  it('should normalize the 3 phone numbers', function () {
    let transform = normalize_phone()
    transform(['1 (123) 456-7890', '1A2B3C4D5E6F7G8H9I0J', 'ABCD'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(3)
      expect(values[0]).to.equal('+11234567890')
      expect(values[1]).to.equal('+11234567890')
      expect(values[2]).to.equal('')
    })
  })
  it('should normalize the phone number that starts with non number', function () {
    let transform = normalize_phone()
    transform(['-1- (-1-2-3) 4-5-6--7-8-90'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('+11234567890')
    })
  })
})
