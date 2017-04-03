/// <reference types="mocha" />

/**
 * IMPORTANT: NODE_ENV=test
 * Set NODE_APP_INSTANCE=X to activate other test-X.json configuration properties
 */

/**
 * retsTimestampPersister.integration.test.ts
 * Seeds the database.collection('imports-test') with n sample imports including ETLServiceConfig.retsQueryStats []
 * Seeds the SQS queue with SNS forwarded Contracts.RetsStatsAvailable messages with { retsQueryStats: [...]}
 * Controls the number of queue cycles by allowing all but 1-2 batch sets remaining
 * Asserts against database.collection('imports-test') that count imports matches the count of messages received
 */

if (process.env.NODE_ENV !== 'test') {
  throw 'NODE_ENV NOT test'
}
import { expect } from 'chai'
import * as AWS from 'aws-sdk'
import * as Faker from 'faker'
import * as config from 'config'
import * as sinon from 'sinon'
import { Contracts, Context, Legacy, ILogger, UtcDateString, QueryType } from 'etl'
import { Aws, Queues } from 'infrastructure-node-cloudservices-lib'
import { getLogger} from 'infrastructure-logging-lib'
import { ImportRepository } from '../../src/lib/importRepository'
import { MongoClient, ObjectID, Db, Collection, BulkWriteResult } from 'mongodb'
import { RetsTimestampPersister, IOptions } from '../../src/lib/retsTimestampPersister'
import * as Promise from 'bluebird'
import * as _ from 'lodash'
import * as path from 'path'

AWS.config.update({ region: config.get<string>('region') })
const collectionName = 'imports-test'
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

const queueUrl = config.get<string>('retsTimestampPersister.queueUrl')
const sqs = new AWS.SQS()
const mongoClient = new MongoClient()
/** resourceName to query valid results against (contained in every retsQueryStats import) */
const resourceName = Faker.name.firstName()
/** className to query valid results against (contained in every retsQueryStats import) */
const className = Faker.name.lastName()
let context: Context = {
  correlationID: Faker.random.uuid(),
  scheduleId: Faker.random.uuid(),
  protocol: 'RETS',
  period: null,
  startTime: (new Date()).toUTCString() as UtcDateString
}

function getImportConfigDoc(): Legacy.Import {
  let doc: any = {
    _id: new ObjectID(),
    ETLServiceConfig: {
    }
  }
  return doc
}

function genSnsMessageRetsStatsAvaialble(doc: Legacy.Import, context: Context): AwsContracts.SnsPublishedMessage<Contracts.RetsStatsAvailable> {
  let now = new Date()
  let retsStatsAvailable: Partial<Contracts.RetsStatsAvailable> = {
    config: null,
    context: context,
    protocol: 'RETS',
    retsQueryStats: _.times(Faker.random.number({ min: 2, max: 10 })).map((n, index) => {
      return {
        importId: (doc._id).toString(),
        correlationID: context.correlationID,
        resourceName: index === 0 ? resourceName : Faker.name.firstName(),
        className: index === 0 ? className : Faker.name.lastName(),
        lastModTime: now.setMinutes(n).toString(),
        photoLastModTime: now.setMinutes(n).toString(),
        lastRunTime: now.setMinutes(n).toString(),
        query: Faker.internet.url(),
        queryType: 'last_mod' as QueryType
      }
    })
  }
  let snsMessage = {
    Message: JSON.stringify(retsStatsAvailable),
    Signature: Faker.random.uuid()
  } as AwsContracts.SnsPublishedMessage<Contracts.RetsStatsAvailable>
  return snsMessage
}

const nImports = Faker.random.number({ min: 100, max: 200 })
const nCycles = Math.floor(nImports / 10)

const options: IOptions = {
  queueBatchSize: 10,
  mongoConnection: config.get<string>('retsTimestampPersister.mongoConnection'),
  mongoDatabase: config.get<string>('retsTimestampPersister.mongoDatabase'),
  remainingMillisThreshold: 100
}
let nCyclesCompleted = 0
let lastCheckTime = process.hrtime()
const lambdaContext: any | AwsLambda.Context = {
  getRemainingTimeInMillis: function () {
    nCyclesCompleted++
    let remaining = (nCycles - nCyclesCompleted) * 100 + 50
    console.log(`getRemainingTimeInMillis ${remaining} cycles ${nCyclesCompleted} / ${nCycles}`)
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
      seedDb = db.db(config.get<string>('retsTimestampPersister.mongoDatabase'))
    })
}
/**
 * Seed 100 documents into the queue, and some documents to upsert into mongo
 */
function seedDbAndQueue() {
  let imports: any[] = []
  for (let i = 0; i < nImports; i++) {
    let doc = getImportConfigDoc()
    // randomize some duplicates
    imports.push(doc)
  }
  let insertMongoDocs = getSeedDb()
    .then(db => db.createCollection(collectionName))
    .tap((col: Collection) => {
      console.log(`remove all from ${collectionName}`)
      return col.deleteMany({})
    })
    .then((col: Collection) => {
      let op = col.initializeUnorderedBulkOp()
      imports.forEach(doc => {
        op.insert(doc)
      })
      console.log(`inserting ${imports.length} into ${collectionName}`)
      return op.execute()
    })
  return insertMongoDocs.then((result: BulkWriteResult) => {
    console.log(`inserted ${result.nInserted} ok ${result.ok}`, result)
    // randomize the list
    imports = _.shuffle(imports)
    // send all to queue
    return Promise.map(_.chunk(imports, 10), chunk => {
      console.log(`sendMessageBatch ${chunk.length} to ${queueUrl}`)
      return sqs.sendMessageBatch({
        QueueUrl: queueUrl,
        Entries: _.map(chunk, doc => {
          return {
            Id: doc._id.toString(),
            MessageBody: JSON.stringify(genSnsMessageRetsStatsAvaialble(
              doc, _.extend({ importId: doc._id }, context))
            )
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
  let purgeCollection = getSeedDb()
    .then(db => db.collection(collectionName).remove({}))
  let purgeQueue = sqs.purgeQueue({
    QueueUrl: queueUrl
  }).promise()
  return Promise.all([purgeCollection, purgeQueue])
    .spread((purgeQueueResult, purgeCollectionResult) => {
      console.log('purgeQueueResult', purgeQueueResult)
      console.log('purgeCollectionResult', purgeCollectionResult)
    })
}
describe('rets-timestamp-persister-integration', function () {
  this.timeout(5 * 60 * 1000)
  let subject: RetsTimestampPersister = null
  let messagesReceived = 0
  let errors: Error[] = []
  let lambdaStub: any = null
  beforeEach(function () {
    errors = []
    const queueUrl = config.get<string>('retsTimestampPersister.queueUrl')
    const queueClient = new Aws.Queues.SQSQueueClient(new AWS.SQS(), queueUrl)
    const queueService = new Queues.QueueService(queueClient, { maxNumberOfMessages: 10 })
    const consumer = new Queues.QueueConsumer(queueService)
    const importRepository = new ImportRepository(logger)
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
    lambdaStub = sinon.createStubInstance(AWS.Lambda)
    subject = new RetsTimestampPersister(
      lambdaStub,
      lambdaContext,
      consumer,
      mongoClient,
      importRepository,
      logger)
  })
  before(function () {
    return purgeDbAndQueue()
      .then(seedDbAndQueue)
  })
  after(function () {
    if (seedDb) {
      seedDb.close()
    }
  })
  it.only(`should consume ${nCycles} times, update ${nCycles * 10} of ${nImports} imports to ${collectionName}, then selfInvokeAsync`, function (done) {
    let execute: Promise<any> = null
    let ApproximateNumberOfMessages = 0
    subject.selfInvokeAsync = function () {
      let getQueueAttributes = sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      }).promise()
        .then(data => {
          console.log('Attributes', data.Attributes)
          console.log('messagesReceived', messagesReceived)
          ApproximateNumberOfMessages = parseInt(data.Attributes['ApproximateNumberOfMessages'], 10)
          expect(ApproximateNumberOfMessages, `ApproximateNumberOfMessages < ${nImports} - ${messagesReceived}`)
            .to.be.at.most(nImports - messagesReceived)
        })
      Promise.all([getQueueAttributes, execute])
        .then(() => {
          expect(errors, 'errors').to.have.lengthOf(0)
        })
        .then(() => {
          let find: any = {}
          find[`ETLServiceConfig.retsQueryStats.${resourceName}${className}.lastRunTime`] = { $exists: true }
          console.log('find', find)
          return Promise.resolve(seedDb.collection(collectionName).count(find))
        })
        .then(nExpectedImports => {
          expect(nExpectedImports, `nExpectedImports >= messagesReceived ${messagesReceived}`).to.be.at.least(messagesReceived)
          expect(nExpectedImports, `nExpectedImports <= nImports`).to.be.at.most(nImports)
        })
        .asCallback(done)
      return getQueueAttributes
    } as any
    execute = subject.execute(options)
      .catch(err => {
        console.log('execute RetsTimestampPersister', err)
        done(err)
      })
  })
})
