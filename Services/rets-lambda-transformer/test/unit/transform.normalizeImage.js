'use strict'
/* eslint-env mocha */
import { normalize_images } from 'functions'
import { expect } from 'chai'

describe('normalizeImages', function () {
  it('should return a function', function () {
    expect(normalize_images).to.be.a('function')
  })
  it('should return empty array if given', function () {
    let transform = normalize_images()
    transform([[]], (err, values) => {
      expect(err).to.be.a('null')
      expect(values[0]).to.be.an('array')
      expect(values[0].length).to.be.equal(0)
    })
  })
  it('should transform given images', function () {
    let transform = normalize_images()
    transform([[{headerInfo: {contentType: 'image/jpeg', location: 'url', contentDescription: 'description'}}]], (err, values) => {
      expect(err).to.be.a('null')
      expect(values[0]).to.be.an('array')
      expect(values[0].length).to.be.equal(1)
      expect(values[0][0]).to.be.deep.equal({original_url: 'url', order: '0', caption: 'description'})
    })
  })
  it('should transform given images with different fields', function () {
    let transform = normalize_images()
    transform([[
      {
        headerInfo: {
          contentType: 'image/jpeg',
          location: 'url',
          contentDescription: 'description'
        }
      },
      {
        headerInfo: {
          contentType: 'text/plain',
          location: 'url.com',
          objectData: {
            description: 'de'
          },
          objectId: '2'
        }
      }]], (err, values) => {
      expect(err).to.be.a('null')
      expect(values[0]).to.be.an('array')
      expect(values[0].length).to.be.equal(2)
      expect(values[0][0]).to.be.deep.equal({original_url: 'url', order: '0', caption: 'description'})
      expect(values[0][1]).to.be.deep.equal({original_url: 'url.com', order: '2', caption: ''})
    })
  })
  it('should just return image if not expected http response', function () {
    let transform = normalize_images()
    transform([[{headerInfo: {}}, {}]], (err, values) => {
      expect(err).to.be.a('null')
      expect(values[0]).to.be.an('array')
      expect(values[0][0]).to.be.deep.equal({original_url: '', order: '0', caption: ''})
      expect(values[0][1]).to.be.deep.equal({})
    })
  })
  it('should not fail on null values', function () {
    let transform = normalize_images()
    transform([[null, null]], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values[0][0]).to.be.a('null')
      expect(values[0][1]).to.be.a('null')
    })
  })
})
