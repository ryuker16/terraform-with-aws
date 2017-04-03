const Promise = require('bluebird')
const config = require('config')
const mongodb = require('mongodb')
const LegacyImportMapper = require('../../dist/src/legacyImportMapper.js').default
const MongoClient = mongodb.MongoClient
const ObjectId = mongodb.ObjectId
const client = new MongoClient()
const url = config.get('dispatcher.mongoConnection')
const _ = require('lodash')
var mapper = new LegacyImportMapper()
const fs = require('fs')
var DB

var importIds = []
var argvLength = process.argv.length
if (argvLength >= 2) {
	for (var i = 2; i < argvLength; i++) {
		importIds.push(process.argv[i])
	}
}

Promise.fromCallback(function(callback) {
	client.connect(url, {}, callback)
})
.tap((db) => {
	DB = db
})
.then((db) => {
	_.forEach(importIds, (importId) => {
		return Promise.fromCallback(function(callback) {
			return db.collection('imports')
			.findOne(
				{ '_id': new ObjectId(importId) },
				{},
				callback
				)
			})
			.then(function(response) {
				var request = mapper.buildExtractionRequest(response, { context: 'context here' })
				console.log(JSON.stringify(request, null, '\t'))
				fs.writeFile(`./data/${importId}_extract_request.json`, JSON.stringify(request, null, '\t'))
			})
	})
})
.then(() => {
	DB.close()
})