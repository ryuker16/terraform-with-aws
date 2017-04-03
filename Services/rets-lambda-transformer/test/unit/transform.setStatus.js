'use strict'
/* eslint-env mocha */
import { set_status } from 'functions'
import { expect } from 'chai'

describe('set_status', function () {
  it('should return a function', function () {
    expect(set_status).to.be.a('function')
  })

  it('should return active if status is not in given sold_statuses', function (done) {
    let transform = set_status({sold_statuses: ['Sold', 'Sold-In-Office']})
    transform(['Sold-In-Office', 'pending'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(4)
      // sold_statuses is given - so returns either active or closed
      expect(values[0]).to.equal('Sold-In-Office')
      expect(values[1]).to.be.equal('closed')
      expect(values[2]).to.equal('pending')
      expect(values[3]).to.be.equal('active')
      done()
    })
  })

  it('should return given if no sold_statuses supplied', function (done) {
    let transform = set_status()
    transform(['Sold-In-Office', 'closed'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(2)
      // sold_statuses is not given
      expect(values[0]).to.equal('Sold-In-Office')
      expect(values[1]).to.be.equal('closed')
      done()
    })
  })
})
