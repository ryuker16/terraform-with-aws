'use strict'
/* eslint-env mocha */
import { desc_redaction } from 'functions'
import { expect } from 'chai'

describe('descRedaction', function () {
  it('should return a function', function () {
    expect(desc_redaction).to.be.a('function')
  })
  it('should remove emails, websites, and gender', function () {
    let transform = desc_redaction()
    transform(['The email of the woman is email@gmail.com and the website is http://herwebsite.com'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('The email of the is and the website is')
    })
  })
  it('should remove new lines and carriage returns', function () {
    let transform = desc_redaction()
    transform(['This house is lovely\n and you\n should\n buy\r it\r'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('This house is lovely and you should buy it')
    })
  })
  it('Should clean the html', function () {
    let transform = desc_redaction()
    transform(['%{<strong><a href="http://foo.com/">foo</a></strong><img src="http://foo.com/bar.jpg" alt="" />}'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('%{<strong>foo</strong>}')
    })
  })
  // ruby core unescapes the html in the description - need to find a library
  /* it('Should decode/unescape the html', function () {
    let transform = desc_redaction()
    transform(['%{<strong><a href="http://foo.com/">foo</a></strong><img src="http://foo.com/bar.jpg" alt="" />}'], (err, values) => {
      expect(err).to.be.a('null')
      expect(values).to.be.an('array')
      expect(values.length).to.equal(1)
      expect(values[0]).to.equal('foo')
    })
  }) */
})
