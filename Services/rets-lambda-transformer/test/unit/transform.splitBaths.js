'use strict'
/* eslint-env mocha */
import { split_baths } from 'functions'
import { expect } from 'chai'

describe('splitBaths', function () {
  it('should return a function', function () {
    expect(split_baths).to.be.a('function')
  })

  it('should require a bathroom_map', function () {
    expect(split_baths()).to.throw(Error)
  })

  it('should require a bathroom_map', function () {
    expect(split_baths({})).to.throw(Error)
  })

  it('should split a composite bath value to multiple values', function (done) {
    let transform = split_baths({ bathroom_map: { "25": 1 } })
    transform(['3.25'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(2)
      expect(values[0]).to.equal(3)
      expect(values[1]).to.equal(1)
      done()
    })
  })

  it('should not split a non decimal', function (done) {
    let transform = split_baths({ bathroom_map: { "25": 1 } })
    transform(['3'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(2)
      expect(values[0]).to.equal(3)
      expect(values[1]).to.equal(0)
      done()
    })
  })
})
