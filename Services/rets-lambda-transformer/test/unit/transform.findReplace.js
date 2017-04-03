'use strict'
/* eslint-env mocha */
import { gsub } from 'functions'
import { expect } from 'chai'

describe('findReplace', function () {
  it('should return a function', function () {
    expect(gsub).to.be.a('function')
  })

  it('should require a match and replace option', function () {
    expect(gsub()).to.throw(Error)
  })

  it('should perform string replacement', function (done) {
    let transform = gsub({ match: ',', replace: ', ' })
    transform(['a,b,c'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('a, b, c')
      done()
    })
  })
  it('should pass through falsy values', function (done) {
    let transform = gsub({ match: ',', replace: ', ' })
    transform(['a,b,c', '', true], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values[0]).to.equal('a, b, c')
      expect(values[1]).to.equal('')
      expect(values[2]).to.equal(true)
      done()
    })
  })
  it('should not fail on null values', function (done) {
    let transform = gsub({ match: ',', replace: ', ' })
    transform(['a,b,c', '', true, null, 3, null], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values[0]).to.equal('a, b, c')
      expect(values[1]).to.equal('')
      expect(values[2]).to.equal(true)
      expect(values[3]).to.equal(null)
      expect(values[4]).to.equal(3)
      expect(values[5]).to.equal(null)
      done()
    })
  })
  it('should not fail on null values', function (done) {
    let transform = gsub({ match: ',', replace: ', ' })
    transform([null], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values[0]).to.equal(null)
      done()
    })
  })
})
