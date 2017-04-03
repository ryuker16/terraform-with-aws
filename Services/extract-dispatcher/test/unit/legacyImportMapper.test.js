'use strict'
/* eslint-env mocha */
const LegacyImportMapper = require('src/legacyImportMapper').default
const chai = require('chai')
const assert = chai.assert
const expect = chai.expect
const Faker = require('faker')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)

describe('Single Field mapping tests', () => {
  let mapper = null
  beforeEach(() => {
    mapper = new LegacyImportMapper()
  })
  it('simple case with no functions', (done) => {
    let mapped = mapper.mapField({
      'type': 'string',
      'unconv_key': 'StreetDirection'
    }, 'location/street_direction')

    let expectMap = [{
      source: ['StreetDirection'],
      target: ['location.street_direction'],
      type: 'string'
    }]
    assert.typeOf(mapped, 'array')
    assert.strictEqual(mapped.length, 1)
    assert.sameDeepMembers(mapped, expectMap)
    done()
  })

  it('simple case with function', (done) => {
    let mapped = mapper.mapField({
      'type': 'string',
      'unconv_key': 'StreetName',
      'suffix_with': 'StreetSuffix'
    }, 'location/street_name')

    let expectMap = [{
      source: ['StreetName'],
      type: 'string',
      target: ['location.street_name'],
      fn: [{
        name: 'suffix_with',
        arguments: {
          value: 'StreetSuffix'
        }
      }]
    }]

    assert.typeOf(mapped, 'array')
    assert.strictEqual(mapped.length, 1)
    assert.sameDeepMembers(mapped, expectMap)
    done()
  })

  it('composite case with divergent functions', (done) => {
    let mapped = mapper.mapField([
      {
        type: 'float',
        unconv_key: '190',
        gsub: { match: ',', replace: '' }
      },
      { type: 'float', unconv_key: 'CurrentPrice' }
    ], 'location/street_name')

    let expected = [{
      source: ['190'],
      type: 'float',
      fn: [{
        name: 'gsub',
        arguments: {
          match: ',',
          replace: ''
        }
      }],
      target: ['location.street_name']
    }, {
      source: ['CurrentPrice'],
      type: 'float',
      target: ['location.street_name']
    }]

    assert.sameDeepMembers(mapped, expected)

    done()
  })

  it('simple case with gsub function', (done) => {
    let mapped = mapper.mapField({
      'type': 'string',
      'unconv_key': 'RESILEV1',
      'gsub': {
        'match': ',',
        'replace': ', '
      }
    }, 'location/street_name')

    let expected = [{
      source: ['RESILEV1'],
      type: 'string',
      target: ['location.street_name'],
      fn: [{
        name: 'gsub',
        arguments: {
          'match': ',',
          'replace': ', '
        }
      }]
    }]

    assert.typeOf(mapped, 'array')
    assert.strictEqual(mapped.length, 1)
    assert.sameDeepMembers(mapped, expected)

    done()
  })

  it('should account for ruby core nonsense with split_baths', (done) => {
    let mapped = mapper.mapSingle({
      'type': 'split',
      'unconv_key': 'LM_Dec_2',
      'bathroom_map': {
        '5': 1
      }
    }, 'cur_data/split_baths')

    let expected = {
      source: ['LM_Dec_2'],
      type: 'int',
      target: ['cur_data.baths', 'cur_data.half_baths'],
      fn: [{
        name: 'split_baths',
        arguments: {
          'bathroom_map': {
            '5': 1
          }
        }
      }]
    }

    assert.deepEqual(mapped, expected)

    done()
  })

  it('should account for ruby core nonsense with sqft_range', (done) => {
    let mapped = mapper.mapSingle({
      'type': 'string',
      'unconv_key': 'L_Keyword8'
    }, 'cur_data/sqft_range')

    let expected = {
      source: ['L_Keyword8'],
      type: 'float',
      target: ['cur_data.sqft_min', 'cur_data.sqft_max', 'cur_data.sqft'],
      fn: [{
        name: 'split_sqft_range',
        arguments: {}
      }]
    }

    assert.deepEqual(mapped, expected)

    done()
  })

  it('should map a "true" function', (done) => {
    let mapped = mapper.mapSingle({
      'type': 'boolean',
      'unconv_key': 'Furnished',
      'true': '1'
    }, 'uncur_data/furnished')

    let expected = {
      source: ['Furnished'],
      type: 'boolean',
      target: ['uncur_data.furnished'],
      fn: [{
        name: 'true_mapper',
        arguments: {
          'value': '1'
        }
      }]
    }

    assert.deepEqual(mapped, expected)

    done()
  })
})

const mappings = require('./test-data/testMappings')
const fs = require('fs')
const path = require('path')

describe('Map entire import', () => {
  let mapper = null
  beforeEach(() => {
    mapper = new LegacyImportMapper()
  })
  it('should map an entire import without failing', (done) => {
    const fieldMappings = mapper.getFieldMappings(mappings)

    assert.equal(5, fieldMappings.agent.length)
    assert.equal(4, fieldMappings.office.length)
    assert.equal(105, fieldMappings.listing.length)

    fs.writeFileSync(path.resolve(__dirname, 'test-data', 'mappedStuff.json.log'), JSON.stringify(fieldMappings))
    done()
  })
  it('should map an entire import without failing and create a feed id mapping', (done) => {
    let maps = require('./test-data/testMappingsNoFeed')
    const fieldMappings = mapper.getFieldMappings(maps)

    assert.equal(5, fieldMappings.agent.length)
    assert.equal(4, fieldMappings.office.length)
    assert.equal(105, fieldMappings.listing.length)

    fs.writeFileSync(path.resolve(__dirname, 'test-data', 'mappedStuffFeed.json.log'), JSON.stringify(fieldMappings))
    done()
  })
})

describe('LegacyImportMapper', () => {
  let mapper = null
  let legacyImport = null
  let context = null
  beforeEach(() => {
    mapper = new LegacyImportMapper()
    legacyImport = {
      _id: Faker.random.uuid(),
      field_map: { foo: Faker.random.uuid() }
    }
    context = {
      scheduleId: Faker.random.uuid()
    }
  })
  describe('buildExtractionRequest', function () {
    let getImportConfigStub = null
    let getFieldMappingsStub = null
    beforeEach(function () {
      getImportConfigStub = sinon.stub(mapper, 'getImportConfig')
      getFieldMappingsStub = sinon.stub(mapper, 'getFieldMappings')
    })
    it('should return an Extraction.Request extending { context: { importId } }', function () {
      let result = mapper.buildExtractionRequest(legacyImport, context)
      expect(result.context).to.have.property('importId').and.be.equal(legacyImport._id)
    })
    it('should map { config } from getImportConfig', function () {
      let retVal = { foo: Faker.random.uuid() }
      getImportConfigStub.returns(retVal)
      let result = mapper.buildExtractionRequest(legacyImport, context)
      sinon.assert.calledWith(getImportConfigStub, legacyImport)
      expect(result.config).to.be.eq(retVal)
    })
    it('should map { transformManifest } from getFieldMappings(legacyImport.field_map)', function () {
      let retVal = { foo: Faker.random.uuid() }
      getFieldMappingsStub.returns(retVal)
      let result = mapper.buildExtractionRequest(legacyImport, context)
      sinon.assert.calledWith(getFieldMappingsStub, legacyImport.field_map)
      expect(result.transformManifest).to.be.eq(retVal)
    })
  })
  describe('getImportConfig', function () {
    it('should throw without { ETLServiceConfig } ', function () {
      legacyImport.ETLServiceConfig = null
      expect(function () {
        mapper.getImportConfig(legacyImport)
      }).to.throw(TypeError)
    })
    it('should not throw with { ETLServiceConfig } ', function () {
      legacyImport.ETLServiceConfig = {}
      expect(function () {
        mapper.getImportConfig(legacyImport)
      }).not.to.throw()
    })
    describe('with an ETLServiceConfig', function () {
      beforeEach(function () {
        legacyImport.ETLServiceConfig = {

        }
      })
      it('should return an Extraction.Request extending config: { retsQueryStats } from ETLServiceConfig', function () {
        legacyImport.ETLServiceConfig = {
          retsQueryStats: [{
            lastRunTime: Faker.date.recent().toString()
          }]
        }
        let config = mapper.getImportConfig(legacyImport)
        expect(config.retsQueryStats).to.be.equal(legacyImport.ETLServiceConfig.retsQueryStats)
      })
      it('should return a config with { ETLServiceConfig } ', function () {
        legacyImport.core_class = Faker.name.firstName()
        legacyImport.provider_id = Faker.random.uuid()
        let config = mapper.getImportConfig(legacyImport)
        expect(config).to.have.property('importId').and.be.eq(legacyImport._id)
        expect(config, 'maps core_class to protocol').to.have.property('protocol').and.be.eq(legacyImport.core_class)
        expect(config.providerId, 'maps provider_id to providerId').to.be.eq(legacyImport.provider_id)
      })
      it('should return destination collection from ETLServiceConfig', function () {
        legacyImport.ETLServiceConfig.destinationCollection = Faker.name.title()
        let config = mapper.getImportConfig(legacyImport)
        expect(config).to.have.property('destinationCollection').and.be.eq(legacyImport.ETLServiceConfig.destinationCollection)
      })
      it('should error without config.listing if RETS', function () { 
        expect(function () {
          legacyImport.core_class = 'RETS'
          mapper.getImportConfig(legacyImport)
        }).to.throw()
      })
      describe('with core_class=RETS and { config }', function () {
        beforeEach(function () {
          legacyImport.config = {}
          legacyImport.core_class = 'RETS'
        })
        it('should map { connection }', function () {
          let config = mapper.getImportConfig(legacyImport)
          expect(config).to.have.property('connection')
          expect(config.connection).to.have.property('url')
        })
      })
      describe('with core_class=RETS and { config.listing }', function () {
        beforeEach(function () {
          legacyImport.config = {
            listing: {}
          }
          legacyImport.core_class = 'RETS'
        })
        it('should map resource.resoType based on listing -> property', function () {
          let config = mapper.getImportConfig(legacyImport)
          expect(config).to.have.property('resources')
          expect(config.resources).to.be.a('array')
          expect(config.resources[0]).to.have.property('resoType').and.be.eq('property')
        })
        it('should map config.listing.classes keys to resources[].classes[].className', function () {
          let classes = [Faker.name.firstName(), Faker.name.lastName()]
          legacyImport.config.listing.classes = {}
          legacyImport.config.listing.classes[classes[0]] = Faker.name.jobTitle()
          legacyImport.config.listing.classes[classes[1]] = Faker.name.jobTitle()
          let config = mapper.getImportConfig(legacyImport)
          expect(config).to.have.property('resources')
          expect(config.resources[0].classes).to.be.a('array')
          expect(config.resources[0].classes).to.have.lengthOf(2)
          expect(config.resources[0].classes[0].className).to.be.eq(classes[0])
          expect(config.resources[0].classes[1].className).to.be.eq(classes[1])
        })
      })
    })
  })
  describe('getListingResources', function () {
    let listingConfig = null
    let serviceConfig = null
    beforeEach(function () {
      listingConfig = {}
      serviceConfig = { resources: [] }
    })
    it('should build { resoType, resourceName }', function () {
      listingConfig.type = Faker.name.firstName()
      let result = mapper.getListingResources(listingConfig, serviceConfig)
      expect(result).to.have.property('resourceName').to.be.eq(listingConfig.type)
      expect(result).to.have.property('resoType').to.be.eq('property')
    })
    it('should merge/assign from the ETLServiceConfig resources by { resoType }', function () {
      listingConfig.type = Faker.name.firstName()
      let expectedResource = {
        resoType: 'property',
        foo: Faker.random.uuid()
      }
      serviceConfig.resources.push(expectedResource)
      let result = mapper.getListingResources(listingConfig, serviceConfig)
      expect(result).to.have.property('foo').to.be.eq(expectedResource.foo)
    })
    it('should NOT merge/assign from the ETLServiceConfig resources when not matching { resoType }', function () {
      listingConfig.type = Faker.name.firstName()
      let expectedResource = {
        resoType: 'not_property',
        foo: Faker.random.uuid()
      }
      serviceConfig.resources.push(expectedResource)
      let result = mapper.getListingResources(listingConfig, serviceConfig)
      expect(result).not.to.have.property('foo').to.be.eq(expectedResource.foo)
    })
    it('should build classes from config.listing keys as className: purchaseType', function () {
      listingConfig.type = Faker.name.firstName()
      listingConfig.classes = {
        // foo is className and lastname is purchaseType
        'foo': Faker.name.lastName()
      }
      let expectedResource = {
        resoType: 'property',
        retsQueryFields: { lastModField: Faker.name.firstName() }
      }
      serviceConfig.resources.push(expectedResource)
      let result = mapper.getListingResources(listingConfig, serviceConfig)
      expect(result.classes[0]).to.have.property('retsQueryFields').to.be.eq(expectedResource.retsQueryFields)
      expect(result.classes[0]).to.have.property('className').to.be.eq('foo')
      expect(result.classes[0]).to.have.property('purchaseType').to.be.eq(listingConfig.classes['foo'])
    })
    it('should extend classes from config.listing from matching ETLServiceConfig.resources.classes', function () {
      listingConfig.type = Faker.name.firstName()
      listingConfig.classes = {
        // foo is className and lastname is purchaseType
        'foo': Faker.name.lastName()
      }
      let extendedProperty = Faker.random.uuid()
      let expectedResource = {
        resoType: 'property',
        classes: [{
          className: 'not_foo',
          extendedProperty: 'something_else'
        }, {
          className: 'foo',
          extendedProperty
        }]
      }
      serviceConfig.resources.push(expectedResource)
      let result = mapper.getListingResources(listingConfig, serviceConfig)
      expect(result.classes).to.have.lengthOf(1)
      expect(result.classes[0]).to.have.property('className').to.be.eq('foo')
      expect(result.classes[0]).to.have.property('extendedProperty').to.be.eq(extendedProperty)
    })
  })
  describe('isRetsImportConfig', function () {
    it('should return true if protocol === RETS', function () {
      expect(LegacyImportMapper.isRetsImportConfig({ protocol: Faker.random.uuid() })).not.be.be.ok
      expect(LegacyImportMapper.isRetsImportConfig({ protocol: 'RETS' })).to.be.ok
    })
  })
})
