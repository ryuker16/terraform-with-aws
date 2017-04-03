/* eslint-env mocha */
'use strict'
require('reflect-metadata')
const RetsImporterService = require('src/lib/rets/retsImporterService').RetsImporterService
// const Logger = require('src/lib/logger')
const chai = require('chai')
const sinon = require('sinon')
const chaiAsPromised = require('chai-as-promised')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
chai.use(chaiAsPromised)
const shortid = require('shortid')
const _ = require('lodash')
const moment = require('moment')
const Promise = require('bluebird')
const Faker = require('faker')
const Rx = require('rx')

const ntimes = function (n, cb) {
  for (var i = 0; i < n; i++) {
    cb(i)
  }
}
const genClass = function () {
  return {
    className: shortid.generate(),
    query: shortid.generate()
  }
}
const genClasses = function (count) {
  let classes = []
  ntimes(count, () => classes.push(genClass()))
  return classes
}
let sampleConfig = {
  'protocol': 'RETS',
  'name': shortid.generate(),
  'connection': {
    'url': shortid.generate(),
    'username': shortid.generate(),
    'password': shortid.generate()
  },
  'resources': [
    {
      'resoType': 'property',
      'resourceName': shortid.generate(),
      'classes': []
    },
    {
      'resoType': 'office',
      'resourceName': shortid.generate(),
      'classes': []
    }
  ]
}
describe('RetsImporterService', function () {
  it('should export class', function () {
    expect(RetsImporterService).to.be.a('function')
  })
  it('what about unhandled_rejection ?', function () {
    return new Promise((resolve, reject) => {
      throw new TypeError('thing')
    }).catch((err) => console.error(err))
  })
  it('what about unhandled_rejection nested', function (done) {
    let fn = function () {
      return new Promise((resolve, reject) => {
        throw new TypeError('thing')
      })
    }
    let promise = fn()
    promise.then(done).catch(() => done())
  })

  describe('constructor', function () {
    it('should throw without retsClient', function () {
      expect(() => {
        return new RetsImporterService(null)
      }).to.throw(TypeError)
    })
    it('should be ok with retsClient', function () {
      expect(() => {
        return new RetsImporterService({})
      }).to.not.throw
    })
  })// end constructor

  describe('static methods', function () {
    describe('mapClientSettings', function () {
      var username
      var password
      var url
      var method
      var retsVersion
      beforeEach(() => {
        username = shortid.generate()
        password = shortid.generate()
        url = shortid.generate()
        method = shortid.generate()
        retsVersion = shortid.generate()
      })
      it('should throw without connection: {}', () => {
        expect(() => {
          RetsImporterService.mapClientSettings({})
        }).to.throw(TypeError)
      })
      it('should map connection { username, password }', () => {
        var input = { connection: { username, password } }
        var output = RetsImporterService.mapClientSettings(input)
        expect(output.username).to.be.equal(username)
        expect(output.password).to.be.equal(password)
      })
      it('should map connection { url } to loginUrl', () => {
        var input = { connection: { username, password, url } }
        var output = RetsImporterService.mapClientSettings(input)
        expect(output.loginUrl).to.be.equal(url)
      })
      it('should map connection { retsVersion, method } to version, method', () => {
        var input = { connection: { retsVersion, method } }
        var output = RetsImporterService.mapClientSettings(input)
        expect(output.method).to.be.equal(method)
        expect(output.version).to.be.equal(retsVersion)
      })
    })
    describe('determineSearchString', function () {
      let resourceModel = null
      let classModel = null
      let importConfig = null
      let queryStats = []
      let resourceName = null
      let className = null
      beforeEach(function () {
        resourceName = Faker.name.firstName()
        className = Faker.name.firstName()
        resourceModel = {
          resourceName,
          query: '(ModificationTimestamp=#{TIMESTAMP})'
        }
        classModel = {
          resourceName,
          className
        }
        importConfig = {
          retsQueryStats: {
          }
        }
      })
      it('should parse #{TIMESTAMP} using retsQueryStats lastRunTime and YYY-MM-DDTHH:MM:SS DMQL format', function () {
        let lastRunTime = '2009-02-14T14:23:59'
        let expected = `(ModificationTimestamp=2009-02-14T14:23:59+)`
        importConfig.retsQueryStats[`${classModel.resourceName}${classModel.className}`] = {
          queryType: 'last_mod',
          lastRunTime: lastRunTime,
          resourceName,
          className
        }
        let result = RetsImporterService.determineSearchString(resourceModel, classModel, importConfig)
        expect(result).to.be.equal(expected)
      })
      it('should parse #{TIMESTAMP} using default time if queryStats: lastRunTime is blank', function () {
        let lastRunTime = null
        importConfig.retsQueryStats[`${classModel.resourceName}${classModel.className}`] = {
          lastRunTime: lastRunTime,
          resourceName,
          className
        }
        let result = RetsImporterService.determineSearchString(resourceModel, classModel, importConfig)
        expect(result).to.contain(moment.utc().add(-1, 'days').format('YYYY-MM-DDTHH:mm:ss'))
      })
      it('should parse #{TIMESTAMP} using default time for now if stats: lastRunTime is invalid', function () {
        // 90 seconds not good
        let lastRunTime = '2011-10-10T10:20:90'
        importConfig.retsQueryStats[`${classModel.resourceName}${classModel.className}`] = {
          lastRunTime: lastRunTime,
          resourceName,
          className
        }
        let result = RetsImporterService.determineSearchString(resourceModel, classModel, importConfig, queryStats)
        expect(result).to.contain(moment.utc().add(-1, 'days').format('YYYY-MM-DD'))
      })
      it('should parse #{TIMESTAMP} using default time for now if queryStat is not found for resource class', function () {
        let lastRunTime = '2011-10-10T10:20:43'
        importConfig.retsQueryStats[`${classModel.resourceName}${classModel.className}`] = {
          lastRunTime: lastRunTime,
          resourceName: Faker.random.uuid(),
          className: Faker.random.uuid()
        }
        let result = RetsImporterService.determineSearchString(resourceModel, classModel, importConfig, queryStats)
        expect(result).to.contain(moment.utc().add(-1, 'days').format('YYYY-MM-DD'))
      })
      it('should parse #{TIMESTAMP} from the queries array if without a replacement', function () {
        let queries = [{
          query: shortid.generate()
        }]
        let result = RetsImporterService.determineSearchString(resourceModel, classModel, importConfig, queries[0])
        expect(result).to.be.equal(queries[0].query)
      })

      it('should parse #{TIMESTAMP} from the queries array if with a replacement', function () {
        let expected = `(CustomizedQuery=2009-02-14T14:23:59+)`
        let lastRunTime = '2009-02-14T14:23:59'
        importConfig.retsQueryStats[`${classModel.resourceName}${classModel.className}`] = {
          queryType: 'last_mod',
          lastRunTime: lastRunTime,
          resourceName,
          className
        }
        let queries = [{
          query: '(CustomizedQuery=#{TIMESTAMP})'
        }]
        let result = RetsImporterService.determineSearchString(resourceModel, classModel, importConfig, queries[0])
        expect(result).to.be.equal(expected)
      })
    })// end determineSearchString
    describe('determineQueryOptions', function () {
      let resourceModel = null
      beforeEach(function () {
        resourceModel = {}
      })
      it('should return IQueryOptions without offset if offsetNotSupported', function () {
        resourceModel.offsetNotSupported = true
        let result = RetsImporterService.determineQueryOptions(resourceModel)
        expect(result).to.not.have.property('offset')
      })
      it('should take the resourceModel.limit instead of default limit', function () {
        resourceModel.limit = Faker.random.number()
        let result = RetsImporterService.determineQueryOptions(resourceModel)
        expect(result.limit).to.be.eq(resourceModel.limit)
      })
    })// end determineQueryOptions
    describe('mapClassNames', function () {
      it('should return null if none', function () {
        expect(RetsImporterService.mapClassNames(null)).to.have.lengthOf(0)
      })
      it('should return className array', function () {
        let c1 = shortid.generate()
        let c2 = shortid.generate()
        let result = RetsImporterService.mapClassNames([
          { className: c1 },
          { className: c2 }
        ])
        expect(result).to.have.lengthOf(2)
        expect(result[0]).to.be.eq(c1)
        expect(result[1]).to.be.eq(c2)
      })
    })// end mapClassNames
    describe('determineLastModTime', function () {
      let queryModel = null
      let queryStat = null
      beforeEach(function () {
        queryModel = {}
        queryStat = {}
      })
      it('should return invalid moment without a queryStat', function () {
        queryStat = undefined
        let result = RetsImporterService.determineLastModTime(queryModel, queryStat)
        expect(result.isValid()).to.be.eq(false)
      })
      it('should return lastRunTime with a  queryStat', function () {
        queryStat = {
          lastRuntime: moment.utc().format()
        }
        let result = RetsImporterService.determineLastModTime(queryModel, queryStat)
        expect(result.isValid()).to.be.eq(true)
      })
    })// end determineLastModTime
  })// end static method

  describe('methods', function () {
    var importer
    var serviceStub
    var logger
    var expectedError
    beforeEach(() => {
      serviceStub = sinon.stub({
        getClient: () => { },
        loadListings: () => { },
        importImages: () => { }
      })
      logger = sinon.stub({
        boundary: () => { },
        audit: () => { },
        info: () => { },
        error: () => { },
        telemetry: () => { }
      })
      expectedError = new Error(shortid.generate())
      importer = new RetsImporterService(serviceStub, logger)
    })
    describe('importListings', function () {
      it('should call retsClient.getClient after mapClientSettings', function () {
        let importSettings = { connection: null }
        let clientSettings = { username: null }
        let stub = sinon.stub(RetsImporterService, 'mapClientSettings')
        stub.returns(clientSettings)
        class RetsError extends Error { }
        serviceStub.getClient.throws(new RetsError())
        return Promise.resolve(importer.importListings(importSettings, {})
          .catch((err) => {
            expect(err).to.be.instanceOf(RetsError)
            expect(stub).to.have.been.calledWith(importSettings)
            expect(serviceStub.getClient).to.have.been.calledWith(clientSettings)
            stub.restore()
          }))
      })
      describe('when getClient connects', function () {
        var client
        var importSettings
        var importResourceClassStub
        beforeEach(() => {
          client = sinon.stub({
            search: {
              query: () => {
              }
            }
          })
          importSettings = _.cloneDeep(sampleConfig)
          serviceStub.getClient.callsArgWith(1, client)
          // to handle unhandled_rejection from Bluebird
          serviceStub.getClient.resolves(true)
          importResourceClassStub = sinon.stub(importer, 'importResourceClassComposer')
        })
        afterEach(function () {
          importResourceClassStub.restore()
        })
        it('should importResourceClass for at least the first resourceType and classType', () => {
          importResourceClassStub.rejects(expectedError)
          importSettings.resources.pop()
          importSettings.resources[0].classes = genClasses(1)
          return Promise.resolve(importer.importListings(importSettings))
            .then(expect.fail)
            .catch(() => {
              // resolves even on failures
              expect(serviceStub.getClient).to.have.been.calledOnce
              expect(importResourceClassStub).to.have.callCount(1)
              let loadListings0 = importResourceClassStub.getCall(0)
              expect(loadListings0).to.have.been.calledWith(client)
              expect(loadListings0, 'with resourceModel').to.have.been.calledWith(sinon.match.any, importSettings.resources[0])
              expect(loadListings0, 'with classModel').to.have.been.calledWith(sinon.match.any, sinon.match.any, importSettings.resources[0].classes[0])
            })
        })
        it('should iterate importResourceClass for at least the first resource and multiple classes', () => {
          importResourceClassStub.rejects(expectedError)
          importSettings.resources.pop()
          importSettings.resources[0].classes = genClasses(2)
          return Promise.resolve(importer.importListings(importSettings))
            .catch(() => {
              expect(serviceStub.getClient).to.have.been.calledOnce
              expect(importResourceClassStub).to.have.callCount(2)
              let importResourceClassStub0 = importResourceClassStub.getCall(0)
              expect(importResourceClassStub0).to.have.been.calledWith(sinon.match.any, sinon.match.any, importSettings.resources[0].classes[0])
              let importResourceClassStub1 = importResourceClassStub.getCall(1)
              expect(importResourceClassStub1).to.have.been.calledWith(sinon.match.any, sinon.match.any, importSettings.resources[0].classes[1])
            })
        })
        describe('when each importResourceClass resolves', function () {
          describe('reduceLoadListingResponses', function () {
            var c0, c1, c2, importResourceClassResponses, reduceLoadListingResponsesSpy
            beforeEach(() => {
              c0 = genClass()
              c1 = genClass()
              c2 = genClass()
              importResourceClassResponses = [
                {
                  resoType: importSettings.resources[0].resoType,
                  resourceName: importSettings.resources[0].resourceName,
                  className: c0.className
                },
                {
                  resoType: importSettings.resources[0].resoType,
                  resourceName: importSettings.resources[0].resourceName,
                  className: c1.className
                },
                {
                  resoType: importSettings.resources[1].resoType,
                  resourceName: importSettings.resources[1].resourceName,
                  className: c2.className
                }
              ]
              reduceLoadListingResponsesSpy = sinon.spy(RetsImporterService, 'reduceLoadListingResponses')
            })
            afterEach(function () {
              reduceLoadListingResponsesSpy.restore()
            })
            it('should flatten return object to { resources: [] }', () => {
              importResourceClassStub.onCall(0).resolves(importResourceClassResponses[0])
              importResourceClassStub.onCall(1).resolves(importResourceClassResponses[1])
              importResourceClassStub.onCall(2).resolves(importResourceClassResponses[2])
              importSettings.resources[0].classes = [c0, c1]
              importSettings.resources[1].classes = [c2]
              return Promise.resolve(importer.importListings(importSettings))
                .then((data) => {
                  expect(data).to.have.any.keys('resources')
                  expect(importResourceClassStub).to.have.callCount(3)
                  expect(data.resources, 'resources[]').to.have.lengthOf(2)
                  var resoTypes = _.map(importSettings.resources, (r) => r.resoType)
                  data.resources.forEach((r) => {
                    expect(resoTypes).to.contain(r.resoType)
                  })
                  expect(reduceLoadListingResponsesSpy).to.have.been.calledOnce
                })
            })
            it('should flatten return object to { resources[resoType].classes[classType] }', () => {
              importResourceClassStub.onCall(0).resolves(importResourceClassResponses[0])
              importResourceClassStub.onCall(1).resolves(importResourceClassResponses[1])
              importResourceClassStub.onCall(2).resolves(importResourceClassResponses[2])
              importSettings.resources[0].classes = [c0, c1]
              importSettings.resources[1].classes = [c2]
              return Promise.resolve(importer.importListings(importSettings))
                .then((data) => {
                  expect(data).to.have.any.keys('resources')
                  expect(importResourceClassStub).to.have.callCount(3)
                  expect(data.resources[0].classes).to.have.lengthOf(2)
                  expect(data.resources[1].classes).to.have.lengthOf(1)
                  expect(reduceLoadListingResponsesSpy).to.have.been.calledOnce
                })
            })
          }) // end reduceLoadListingResponses
        }) // end when importResourceClass resolves
      }) // end when getClient connects
    }) // end importListings
    describe('importResourceClass', function () {
      let determineQueryOptionsStub = null
      let determineSearchStringStub = null
      let determineRetsQueryStatsStub = null
      let resource = null
      let classModel = null
      let className = ''
      let resourceName = ''
      let client = null
      let importConfig = null
      let callimportResourceClass = () => Promise.resolve(importer.importResourceClass(client, resource, classModel, importConfig))
      beforeEach(function () {
        client = sinon.stub()
        importConfig = {}
        resourceName = Faker.name.firstName()
        resource = {
          resoType: Faker.name.lastName(),
          resourceName
        }
        classModel = {
          resourceName,
          className
        }
        determineQueryOptionsStub = sinon.stub(RetsImporterService, 'determineQueryOptions')
        determineSearchStringStub = sinon.stub(RetsImporterService, 'determineSearchString')
        determineRetsQueryStatsStub = sinon.stub(RetsImporterService, 'determineRetsQueryStats')
      })
      afterEach(function () {
        determineQueryOptionsStub.restore()
        determineSearchStringStub.restore()
        determineRetsQueryStatsStub.restore()
      })
      it('should loadListings with determineSearchString', function () {
        serviceStub.loadListings.rejects(expectedError)
        let search = Faker.random.uuid()
        determineSearchStringStub.returns(search)
        return callimportResourceClass()
          .then(expect.fail)
          .catch(function (err) {
            expect(err).to.be.eq(expectedError)
            expect(serviceStub.loadListings).to.have.been.calledWith(client, resourceName, className, search)
          })
      })
      it('should determineRetsQueryStats with the resourceName and className', function () {
        serviceStub.loadListings.rejects(expectedError)
        determineRetsQueryStatsStub.returns()
        return callimportResourceClass()
          .then(expect.fail)
          .catch(function (err) {
            expect(err).to.be.eq(expectedError)
            expect(determineRetsQueryStatsStub).to.have.been.calledWith(resourceName, className, importConfig)
          })
      })
      it('should loadListings and then hydrate each ImportResourceClassResponse in the result array', function () {
        serviceStub.loadListings.returns(Promise.resolve({}))
        let expectedStat = { lastRunTime: Faker.date.recent().toString() }
        determineRetsQueryStatsStub.returns(expectedStat)
        return callimportResourceClass()
          .then(function (results) {
            let result = results[0]
            console.log('result', result)
            expect(result).to.have.property('retsQueryStat')
              .that.is.eq(expectedStat)
            expect(logger.audit).to.have.been.calledWith(
              'RetsImporterService.importResourceClass',
              'info',
              sinon.match.has('resourceName', resourceName)
                .and(sinon.match.has('className', className))
                .and(sinon.match.has('retsQueryStat', expectedStat))
            )
            expect(determineRetsQueryStatsStub).to.have.been.calledWith(resourceName, className, importConfig)
          })
      })
    }) // end importResourceClass
    describe('reduceResourceClassResponses', function () {
      var resource = null
      var classModel = null
      var responses = null
      beforeEach(function () {
        resource = {
          resourceName: 'Property',
          resoType: 'property',
          classes: [],
          retsQueryFields: { uniqueIdField: 'LIST_105' }
        }
        classModel = {
          className: 'ClassName'
        }
        responses = []
        let response1 = { results: [] }
        _.times(5, function (index) {
          response1.results.push({ 'LIST_105': index })
        })
        responses.push(response1)
        let response2 = { results: [] }
        _.times(5, function (index) {
          response2.results.push({ 'LIST_105': index * 2 })
        })
        responses.push(response2)
      })
      it('flatten should flatten 2 arrays', function () {
        let result = _.flatten([['a', 'b'], ['c', 'd']])
        expect(result[3]).to.be.eq('d')
      })
      it('uniqBy should return unique elements of array', function () {
        let arr = [{ 'foo': 'a' }, { 'foo': 'b' }, { 'foo': 'a' }]
        let unique = _.uniqBy(arr, function (value) {
          return value['foo']
        })
        expect(unique.length).to.be.eq(2)
      })
      it('mapping the responses should return the set of results arrays', function () {
        let mappedResults = _.map(responses, function (response) {
          return response.results
        })
        let flattenedResults = _.flatten(mappedResults)

        expect(mappedResults.length).to.be.eq(2)
        expect(flattenedResults.length).to.be.eq(10)
      })

      it('flatmap and index should return the number of 7 results in array', function () {
        let flatMapResults = _.flatMap(responses, function (response) {
          return response.results
        })

        let unique = _.uniqBy(flatMapResults, function (value) {
          return value['LIST_105']
        })
        expect(unique.length).to.be.eq(7)
      })
      it('should flatten results and return deduped results array', function () {
        let result = importer.reduceResourceClassResponses(resource, classModel, responses)
        expect(result.results.length).to.be.eq(7)
      })
    }) // end reduceResourceClassResponses
    describe('importResourceClassImages', function () {
      var client
      var resource
      var classModel
      var importConfig
      var uniqueIdField = ''
      var resourceClassResponse = { results: [] }
      beforeEach(() => {
        client = sinon.stub({
          search: {
            query: () => {
            }
          }
        })
        uniqueIdField = Faker.name.firstName()
        resource = { resourceName: 'Property', classes: [], retsQueryFields: { uniqueIdField } }
        classModel = { className: 'Listing' }
        importConfig = {
          protocol: '',
          connection: '',
          resources: []
        }
        resourceClassResponse = {
          results: _.times(6, function () {
            let result = {}
            _.set(uniqueIdField, Faker.random.uuid())
            return result
          })
        }
      })
      it('should return a flat array of image responses', function () {
        serviceStub.importImages.resolves({})
        var processRetsImageResponsesStub = sinon.stub(importer, 'processRetsImageResponses')
        processRetsImageResponsesStub.returns(Rx.Observable.fromArray([]))
        return Promise.resolve(importer.importResourceClassImages(client, resource, classModel, importConfig, resourceClassResponse))
          .then(processedResults => {
            expect(processRetsImageResponsesStub).to.have.callCount(2)
            expect(processedResults).to.be.deep.equal({
              results: resourceClassResponse.results,
              retsDocumentImagesTuples: []
            })
          })
      })
      it('should chunk results and get images response array back', function () {
        serviceStub.importImages.onCall(0).resolves([{ headerInfo: { contentId: '1', objectId: '1' } }, { headerInfo: { contentId: '2', objectId: '1' } }, { headerInfo: { contentId: '3', objectId: '1' } }])
        serviceStub.importImages.onCall(1).resolves([{ error: { headerInfo: { contentId: '6' } }, message: 'No images found for id' }])
        var resourceClassResponse = { results: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }] }
        resource.retsQueryFields.uniqueIdField = 'id'
        return Promise.resolve(importer.importResourceClassImages(client, resource, classModel, importConfig, resourceClassResponse))
          .then(processedResults => {
            expect(serviceStub.importImages).to.have.callCount(2)
            expect(processedResults).to.be.deep.equal({
              results: resourceClassResponse.results,
              retsDocumentImagesTuples: [
                {
                  retsDocumentId: '1',
                  retsDocumentBody: { id: '1' },
                  retsDocumentImages: [{ headerInfo: { contentId: '1', objectId: '1' } }]
                },
                {
                  retsDocumentId: '2',
                  retsDocumentBody: { id: '2' },
                  retsDocumentImages: [{ headerInfo: { contentId: '2', objectId: '1' } }]
                },
                {
                  retsDocumentId: '3',
                  retsDocumentBody: { id: '3' },
                  retsDocumentImages: [{ headerInfo: { contentId: '3', objectId: '1' } }]
                },
                {
                  retsDocumentId: '4',
                  retsDocumentBody: { id: '4' },
                  retsDocumentImages: []
                },
                {
                  retsDocumentId: '5',
                  retsDocumentBody: { id: '5' },
                  retsDocumentImages: []
                },
                {
                  retsDocumentId: '6',
                  retsDocumentBody: { id: '6' },
                  retsDocumentImages: []
                }
              ]
            })
          })
      })
    })// end reduceResourceClassResponses
    describe('processRetsImageResponses', function () {
      it('should group image response with correct rets result documents', function () {
        let resourceClassResponse = {
          results: [
            { id: '1' },
            { id: '2' },
            { id: '3' }
          ]
        }
        let imagesResponse = [
          {
            headerInfo: {
              contentId: '2',
              objectId: '1',
              location: 'url1.com'
            }
          },
          {
            headerInfo: {
              contentId: '2',
              objectId: '0',
              location: 'url0.com'
            }
          },
          {
            headerInfo: {
              contentId: '3',
              objectId: '1',
              location: 'url1.com'
            }
          },
          {
            headerInfo: {
              contentId: '3',
              objectId: '2',
              location: 'url2.com'
            }
          },
          {
            headerInfo: {
              contentId: '1',
              objectId: '1',
              location: 'url1.com'
            }
          },
          {
            error: 'Error fetching image 0'
          }
        ]
        let expectedResult = [
          {
            retsDocumentId: '1',
            retsDocumentBody: { id: '1' },
            retsDocumentImages: [
              {
                headerInfo: {
                  contentId: '1',
                  objectId: '1',
                  location: 'url1.com'
                }
              }
            ]
          },
          {
            retsDocumentId: '2',
            retsDocumentBody: { id: '2' },
            retsDocumentImages: [
              {
                headerInfo: {
                  contentId: '2',
                  objectId: '1',
                  location: 'url1.com'
                }
              },
              {
                headerInfo: {
                  contentId: '2',
                  objectId: '0',
                  location: 'url0.com'
                }
              }
            ]
          },
          {
            retsDocumentId: '3',
            retsDocumentBody: { id: '3' },
            retsDocumentImages: [
              {
                headerInfo: {
                  contentId: '3',
                  objectId: '1',
                  location: 'url1.com'
                }
              },
              {
                headerInfo: {
                  contentId: '3',
                  objectId: '2',
                  location: 'url2.com'
                }
              }
            ]
          }
        ]
        let uniqueFieldId = 'id'
        let aggregatedTuples = []
        return importer.processRetsImageResponses(
          resourceClassResponse.results,
          imagesResponse,
          uniqueFieldId,
          (tuple) => aggregatedTuples.push(tuple))
          .toArray()
          .toPromise()
          .then((tuples) => {
            expect(tuples, 'Observable tuples').to.be.deep.equal(expectedResult)
            expect(aggregatedTuples, 'aggregated tuples').to.be.deep.equal(expectedResult)
          })
      })
      it('should not throw if results or image responses are empty', function () {
        expect(() => importer.processRetsImageResponses([], [], 'id')).to.not.throw
      })
      it('should log uniqueId and uniqueFieldId on error', function () {
        let resourceClassResponse = {
          results: [
            { id: '1' }
          ]
        }
        let imagesResponse = [
          {
            headerInfo: {
              contentId: '1',
              objectId: '1',
              location: 'url1.com'
            },
            error: 'Missing image info'
          }
        ]
        let tuples = []
        importer.processRetsImageResponses(
          resourceClassResponse.results,
          imagesResponse,
          'id',
          (tuple) => tuples.push(tuple))
        expect(tuples.retsDocumentImages).to.be.empty
      })
    })
  })// end methods
})// end RetsImporterService
