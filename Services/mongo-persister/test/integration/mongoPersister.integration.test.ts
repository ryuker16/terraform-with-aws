/// <reference types="mocha" />

/**
 * IMPORTANT: NODE_ENV=test
 * Set NODE_APP_INSTANCE=X to activate other test-X.json configuration properties
 */
if (process.env.NODE_ENV !== 'test') {
  throw 'NODE_ENV NOT test'
}
import { expect } from 'chai'
import * as AWS from 'aws-sdk'
import * as Faker from 'faker'
import * as config from 'config'
import { Contracts, Context, Legacy, ILogger } from 'etl'
import { Aws, Queues } from 'infrastructure-node-cloudservices-lib'
import { getLogger} from 'infrastructure-logging-lib'
import { DocumentStorage } from '../../src/lib/documentStorage'
import { MongoClient, ObjectID, Db, Collection } from 'mongodb'
import { PropertyDocumentPersister } from '../../src/lib/propertyDocumentPersister'
import { IOptions, MongoPersister } from '../../src/lib/mongoPersister'
import { DeliveryStreamS3RecordsExtractor } from '../../src/lib/deliveryStreamS3RecordsExtractor'
import { QueueRecordsExtractor } from '../../src/lib/queueRecordsExtractor'
import * as Promise from 'bluebird'
import * as _ from 'lodash'
import * as path from 'path'
import { MongoDB } from 'infrastructure-node-dbutils'
const MongoDbLogger = require('mongodb').Logger

AWS.config.update({ region: config.get<string>('region') })
const collectionName = 'listings-test'
PropertyDocumentPersister.collectionName = collectionName
const logger = getLogger('mongo-persister-test', 'mongo-persister', null, {
  streams: [{
    stream: process.stdout
  }, {
    type: 'rotating-file',
    path: path.resolve(__dirname, `${path.basename(__filename)}.log`),
    period: '1d',   // daily rotation
    count: 3        // keep 3 back copies
  }]
})

const queueUrl = config.get<string>('persister.queueUrl')
const sqs = new AWS.SQS()
const mongoClient = new MongoClient()

const context: Context = {
  correlationID: Faker.random.uuid(),
  scheduleId: Faker.random.uuid(),
  protocol: 'RETS',
  period: null,
  startTime: null
}

function genDocument(): Legacy.Listings.Listing {
  return {
    _id: new ObjectID(),
    import_id: new ObjectID(),
    feed_id: Faker.random.uuid(),
    correlationID: context.correlationID
  }
}
function genUpsertDocument(): Legacy.Listings.Listing {
  let doc: any = {
    import_id: new ObjectID(),
    feed_id: Faker.random.uuid(),
    correlationID: context.correlationID
  }
  doc._id = ObjectID.createFromHexString(MongoDB.genHashForObjectId([doc.import_id, doc.feed_id]))
  return doc
}

function genSnsMessage(doc: any): Partial<AwsContracts.SnsPublishedMessage<Contracts.RetsDocumentTransformedEvent>> {
  let rdt: Partial<Contracts.RetsDocumentTransformed> = {
    protocol: 'RETS',
    config: {
      protocol: 'RETS',
      destinationCollection: collectionName,
      resources: null,
      retsQueryStats: null,
      importId: Faker.random.uuid(),
      providerId: Faker.random.uuid(),
      scheduleId: Faker.random.uuid(),
      connection: null
    },
    context: context,
    transformedDocumentBody: doc
  }
  return {
    Message: JSON.stringify(rdt),
    // trigger the QueueRecordsExtractor to read the SNS message
    Type: 'Notification'
  }
}

const nDocs = Faker.random.number({ min: 100, max: 200 })
const nUpserts = Faker.random.number({ min: 10, max: 100 })
const nCycles = Faker.random.number({ min: 10, max: Math.floor(nDocs / 10) })
const options: IOptions = {
  upsertMode: 'single',
  queueBatchSize: 10,
  mongoConnection: config.get<string>('persister.mongoConnection'),
  remainingMillisThreshold: 100
}
let remainingChecks = 0
let lastCheckTime = process.hrtime()
const lambdaContext: any | AwsLambda.Context = {
  getRemainingTimeInMillis: function () {
    let remaining = (nCycles - remainingChecks) * 100 + 50
    remainingChecks++
    console.log('getRemainingTimeInMillis', remaining)
    let delta = process.hrtime(lastCheckTime)
    console.log('durationSince', delta[0], 's', delta[1] / 1000000, 'ms')
    lastCheckTime = process.hrtime()
    return remaining
  }
}

let seedDb: Db = null
function getSeedDb() {
  if (seedDb) {
    return Promise.resolve(seedDb)
  }
  logger.audit(`connecting to ${options.mongoConnection}...`, 'debug')
  return Promise.resolve(mongoClient.connect(options.mongoConnection))
    .tap(db => {
      seedDb = db
    })
}
function getSeedDbCollection() {
  return getSeedDb()
    .then(db => db.collection(collectionName))
}
/**
 * Seed 100 documents into the queue, and some documents to upsert into mongo
 */
function seedDbAndQueue() {
  let docs: any[] = []
  for (let i = 0; i < nUpserts; i++) {
    let doc = genUpsertDocument()
    // randomize some duplicates
    docs.push(doc)
  }
  let insertMongoDocs = getSeedDbCollection()
    .tap(() => {
      // Set debug level
      MongoDbLogger.setLevel('info')
      // Set our own logger
      MongoDbLogger.setCurrentLogger(function (msg: string, context: any) {
        console.log('MongoDB', msg, context)
        logger.audit(msg, 'debug', context)
      })
    })
    .tap((col: Collection) => col.deleteMany({}).then(console.log.bind(console, 'collection.deleteMany')))
    .then((col: Collection) => {
      let op = col.initializeUnorderedBulkOp()
      docs.forEach(doc => {
        op.insert(doc)
      })
      return op.execute()
    })
  return insertMongoDocs.then(result => {
    console.log('insertMongoDocs', {
      nInserted: result.nInserted,
      ok: result.ok
    })
    for (let i = 0; i < nDocs - nUpserts; i++) {
      docs.push(genDocument())
    }
    // randomize the list
    docs = _.shuffle(docs)
    // send all to queue
    return Promise.map(_.chunk(docs, 10), chunk => {
      return sqs.sendMessageBatch({
        QueueUrl: queueUrl,
        Entries: _.map(chunk, doc => {
          return {
            Id: doc.feed_id.toString(),
            MessageBody: JSON.stringify(genSnsMessage(doc))
          }
        })
      }).promise()
    }).then(sendMessageBatchResultList => {
      console.log('sendMessageBatch', {
        nSuccessful: _.sumBy(sendMessageBatchResultList, (r) => r.Successful.length)
      })
    })
  })
}

function purgeDbAndQueue() {
  let purgeCollection = getSeedDbCollection()
    .then((col) => col.deleteMany({}))
    .tap(console.log.bind(console, 'collection.deleteMany'))

  let purgeQueue = sqs.purgeQueue({
    QueueUrl: queueUrl
  }).promise()

  return Promise.all([purgeCollection, purgeQueue])
    .spread((purgeQueueResult, purgeCollectionResult) => {
      console.log('purgeQueueResult', purgeQueueResult)
      console.log('purgeCollectionResult', purgeCollectionResult)
    })
}

function getCollectionCount() {
  return getSeedDbCollection()
    .then((col) => {
      console.log('counting records with correlationID', context.correlationID, col.collectionName)
      return col.find({ correlationID: context.correlationID }).count(false)
    })
}

describe('mongo-persister-integration', function () {
  this.timeout(5 * 60 * 1000)
  let persister: MongoPersister = null
  let messagesReceived = 0
  let errors: Error[] = []
  beforeEach(function () {
    errors = []
    const queueUrl = config.get<string>('persister.queueUrl')
    const queueClient = new Aws.Queues.SQSQueueClient(new AWS.SQS(), queueUrl)
    const queueService = new Queues.QueueService(queueClient, { maxNumberOfMessages: 10 })
    const consumer = new Queues.QueueConsumer(queueService)
    const documentStorage = new DocumentStorage(new AWS.S3())
    const documentPersister = new PropertyDocumentPersister(logger)
    const recordsExtractor = new DeliveryStreamS3RecordsExtractor(logger, new AWS.S3())
    const queueMessageParser = new QueueRecordsExtractor(recordsExtractor)
    for (let e in Queues.QueueConsumer.Events) {
      consumer.on(e, function (data: any) {
        if (e.indexOf('error') > -1) {
          console.error('QueueConsumer', e, data.err)
          errors.push(data.err)
        }
      })
    }
    consumer.on(Queues.QueueConsumer.Events.messages_processed, function (data: Queues.IQueueConsumerEvent<any, any>) {
      console.log('messages_processed', {
        // result: data.result,
        messages: data.messages.length
      })
    })
    consumer.on(Queues.QueueConsumer.Events.message_deleted, function (data: Queues.IQueueConsumerEvent<any, any>) {
      console.log('message_deleted', {
        message: data.message
      })
    })
    consumer.on(Queues.QueueConsumer.Events.messages_received, function (data: Queues.IQueueConsumerEvent<any, any>) {
      console.log('messages_received', {
        messages: data.messages.length
      })
      messagesReceived += data.messages.length
    })
    persister = new MongoPersister(new AWS.Lambda(), lambdaContext, consumer, documentStorage, documentPersister, mongoClient, queueMessageParser, logger)
  })
  /**
   * Remove documents from DB collection
   * Run the purgeQueue operation (can only be done once a minute)
   * Seed documents to the database and the sqs queue
   */
  before(function () {
    return purgeDbAndQueue()
      .then(seedDbAndQueue)
  })
  after(function () {
    if (seedDb) {
      seedDb.close()
    }
  })
  it.only(`should consume ${nCycles} times, upsert about ${nUpserts} / ${nDocs} documents to ${collectionName}, then selfInvokeAsync`, function (done) {
    let execute: Promise<any> = null
    let ApproximateNumberOfMessages = 0
    persister.selfInvokeAsync = function () {
      console.log('selfInvokeAsync')
      let getQueueAttributes = sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      }).promise()
        .then(data => {
          console.log('Attributes', data.Attributes)
          console.log('messagesReceived', messagesReceived)
          ApproximateNumberOfMessages = parseInt(data.Attributes['ApproximateNumberOfMessages'], 10)
          // ApproximateNumberOfMessages should the amount nDocs less the messagesReceived
          expect(ApproximateNumberOfMessages, `ApproximateNumberOfMessages < ${nDocs} - ${messagesReceived}`)
            .to.be.at.most(nDocs - messagesReceived)
        })
      // wait to retrieve queue info and when the entire MongoPersister.execute has completed
      Promise.all([getQueueAttributes, execute])
        .delay(1000)
        .then(() => {
          expect(errors, 'errors').to.have.lengthOf(0)
        })
        .then(getCollectionCount)
        .then(dbCount => {
          // mongoPersister should have added new items to the table
          expect(dbCount, 'dbCount > nUpserts').to.be.above(nUpserts)
          // mongoPersister should have maintained the index behavior and not re-inserted
          expect(dbCount, 'dbCount <= nDocs').to.be.at.most(nDocs)
        })
        .asCallback(done)
      // return early to the selfInvokeAsync to allow execute to finish
      return Promise.delay(1000)
    } as any
    execute = persister.execute(options)
      .catch(err => {
        console.error('execute', err)
        done(err)
      })
  })
})
