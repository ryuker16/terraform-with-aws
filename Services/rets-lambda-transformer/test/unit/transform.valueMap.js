'use strict'
/* eslint-env mocha */
import { value_map } from 'functions'
import { expect } from 'chai'

describe('valueMap', function () {
  it('should return a function', function () {
    expect(value_map).to.be.a('function')
  })

  it('should require a map and retsValue option', function () {
    expect(value_map()).to.throw(Error)
  })

  it('should perform a value mapping', function (done) {
    let map = {
      '3plex': 'res_rental',
      '4plex': 'res_rental',
      'apartment complex': 'res_rental',
      'condominium': 'res_rental',
      'corporate rentals': 'res_rental',
      'duplex/double': 'res_rental',
      'hotel': 'res_rental',
      'motel': 'res_rental',
      'office building': 'comm_rental',
      'other': 'comm_rental',
      'retail': 'comm_rental',
      'restaurant': 'comm_rental',
      'single family': 'res_rental',
      'shopping center': 'comm_rental',
      'townhouse': 'res_rental',
      'vacant land': 'comm_rental',
      'warehouse': 'comm_rental'
    }

    let transform = value_map(map)
    transform(['hotel', 'office building'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(2)
      expect(values[0]).to.equal('res_rental')
      expect(values[1]).to.equal('comm_rental')
      done()
    })
  })
})
