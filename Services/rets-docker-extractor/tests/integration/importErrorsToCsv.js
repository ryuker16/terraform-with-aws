/* DEBUG=rets-client* mocha __filename */
/**
 * npm install json2csv --save-dev
 */
'use strict'
/**
 * similar to import statement in Java
 * using statement in C#
 */

/**
 * HOW TO RUN
 * filter is optional, otherwise returns errors on Flex MLSes
 * node tools/importErrorsToCsv.js --filter {search_string}
 */
const path = require('path')
const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const fs = require('fs')
const Promise = require('bluebird')
const parseArgs = require('minimist')
const json2csv = require('json2csv')
var filter = "flex"

// print process.argv
process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`)
})

let args = parseArgs(process.argv.slice(2))
console.log('args', args)

// check to see if a regex filter on the URL was passed as an option
if (args.filter>""){
    filter = args.filter
}

function run () {
  let db = null

  // http://mongodb.github.io/node-mongodb-native/2.2/api/MongoClient.html#.connect
  let client = new MongoClient()
  // http://bluebirdjs.com/docs/api/promise.resolve.html
  return Promise.resolve(client.connect('mongodb://ec2-54-218-48-172.us-west-2.compute.amazonaws.com:29000/placester_production'))
    // http://bluebirdjs.com/docs/api/tap.html
    .tap(() => console.log('connected'))
    .then((database) => {
      db = database

      // filter contains value to search errors.
      var search= "/*."+filter+".+/"

      // http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#aggregate
      return db.collection('imports_metadata').aggregate([
        { $match: { 'metadata.tables.metadata': { $exists: 0 }, 'retsConnection.url': RegExp(search) } },
        { $project: {
          _id: 1,
          url: '$retsConnection.url',
          message: '$errors.message',
          replyText: '$errors.replyText',
          retsMethod: '$errors.retsMethod',
          httpStatus: '$errors.httpStatus',
          httpStatusMessage: '$errors.httpStatusMessage'
        }
        }])
        // http://mongodb.github.io/node-mongodb-native/2.2/api/AggregationCursor.html#toArray
        .toArray()
    })
    .tap((aggregationArray) => console.log('aggregate', aggregationArray.length))
    .then(aggregationArray => {
      // https://www.npmjs.com/package/json2csv
      let fields = ['_id', 'url', 'message', 'replyText', 'retsMethod', 'httpStatus', 'httpStatusMessage']
      let csv = json2csv({ data: aggregationArray, fields })
      // http://bluebirdjs.com/docs/api/promise.fromcallback.html
      // https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback
      return Promise.fromCallback(function (cb) {

        let file = path.resolve(__dirname, 'logs/', 'imports_metadata_errors_'+filter+'.csv')

        console.log('writeFile', file)
        if (!fs.existsSync(path.dirname(file))) {
          fs.mkdirSync(path.dirname(file))
        }
        fs.writeFile(file, csv, cb)
      })
    })
    .tap(() => console.log('complete'))
    .catch(console.error.bind(console))
    .finally(() => {
      if (db) {
        db.close()
      }
      process.exit(0)
    })
}

run()
