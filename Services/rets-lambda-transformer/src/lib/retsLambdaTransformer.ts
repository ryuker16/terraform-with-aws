import { IDocumentRepo } from './documentRepo'
import { Lambda, SNS } from 'aws-sdk'
import * as BPromise from 'bluebird'
import { Contracts, IQueueMessage, HashMap, Context, Legacy } from 'etl'
import { DocumentTransformer } from './documentTransformer'
import { EventPublisher } from './eventPublisher'
import { Aws } from 'infrastructure-node-cloudservices-lib'
import { ILogger } from 'infrastructure-logging-lib'
import * as config from 'config'
let propertyAvailableEventArn = config.get<string>('transformer.propertyAvailableEvent')
let propertyDestinationBucket = config.get<string>('transformer.propertyDestinationBucket')

export interface DocumentTransformerFactory {
  (sourceDocument: any): DocumentTransformer
}
export interface IProcessRetsDocumentExtracted {
  context: Context
  transformedDocumentBody: any
  publishMessageResponse: SNS.Types.PublishResponse
  bucket: string
  key: string
}

export class RetsLambdaTransformer extends Aws.Lambda.LambdaHandler<any> {
  constructor(
    private sqsClient: Aws.Queues.SQSQueueClient,
    private repo: IDocumentRepo,
    private publisher: EventPublisher,
    private lambdaClient: Lambda,
    private logger: ILogger,
    lambdaContext: Aws.Lambda.Context,
    private documentTransformerFactory?: DocumentTransformerFactory
  ) {
    super(lambdaClient, lambdaContext)
    if (!documentTransformerFactory) {
      this.documentTransformerFactory = function (data) {
        return new DocumentTransformer(data)
      }
    }
  }

  run() {
    return BPromise.bind(this)
      .then(() => this.sqsClient.getMessage<any>())
      .then((message: IQueueMessage<any>) => {
        if (message && message.Data) {
          const retsDocumentExtracted = JSON.parse(message.Data.Message) as Contracts.RetsDocumentExtracted
          if (retsDocumentExtracted) {
            return this.processRetsDocumentExtracted(retsDocumentExtracted)
              .then(() => {
                return this.sqsClient.deleteMessage(message)
              })
          }
        }
      })
      .then(() => this.sqsClient.getMessage({ maxNumberOfMessages: 1, visibilityTimeout: 0 }))
      .then((message) => {
        if (message) {
          return this.selfInvokeAsync()
        }
      })
  }

  processRetsDocumentExtracted(rde: Contracts.RetsDocumentExtracted): BPromise<any> {
    this.logger.setContext(rde.context)
    let rdt = rde as Contracts.RetsDocumentTransformed
    let bucket = rde.retsDocumentLocation.bucket
    let key = rde.retsDocumentLocation.key
    return BPromise.bind(this)
      .then(() => this.getRetsDocumentBody(rde))
      .then(this.ensureRetsDocumentImages.bind(this, rde))
      .then(this.transformRetsDocument.bind(this, rde))
      .then(function (transformedDocumentBody: Legacy.Listings.Listing) {
        return BPromise.resolve(this.repo.storeTransformedDocument(transformedDocumentBody, propertyDestinationBucket, key))
          .tap(function () {
            rdt.transformedDocumentLocation = {
              bucket: propertyDestinationBucket,
              key: key
            }
          })
          .thenReturn(transformedDocumentBody)
      })
      .then(this.publishTransformedDocument.bind(this, rdt))
      .catch(err => {
        this.logger.error(err, { method: 'RetsLambdaTransformer.processRetsDocumentExtracted' })
        throw err
      })
  }

  getRetsDocumentBody(rde: Contracts.RetsDocumentExtracted): BPromise<any> {
    if (rde.retsDocumentBody) {
      return BPromise.resolve(rde.retsDocumentBody)
    }
    let bucket = rde.retsDocumentLocation.bucket
    let key = rde.retsDocumentLocation.key
    return this.repo.getExtractedDocument<any>(bucket, key)
  }

  ensureRetsDocumentImages(rde: Contracts.RetsDocumentExtracted, doc: any): any {
    if (doc && !doc.images && rde.retsDocumentImages) {
      // need to return the images with the body
      doc.images = rde.retsDocumentImages
    }
    return doc
  }

  transformRetsDocument(rde: Contracts.RetsDocumentExtracted, retsDocumentBody: any): BPromise<Legacy.Listings.Listing> {
    let doc = this.documentTransformerFactory(retsDocumentBody)
    return doc.transform(rde.transformManifest.listing)
      .then(function (transformedDoc: DocumentTransformer) {
        // add import_id from SNS message to document TODO test?
        transformedDoc.set('import_id', rde.config.importId)
        transformedDoc.set('provider_id', rde.config.providerId)
        transformedDoc.set('purchase_types', [rde.retsDocumentMetadata.purchaseType])
        // enrich the document with globally applicable transforms
        return transformedDoc.enrich()
      })
      .then(function (enrichedDoc: DocumentTransformer) {
        return enrichedDoc.hydrate() as Legacy.Listings.Listing
      })
  }

  publishTransformedDocument(rdt: Contracts.RetsDocumentTransformed, transformedDocumentBody: Legacy.Listings.Listing) {
    rdt.transformedDocumentBody = transformedDocumentBody
    return BPromise.resolve(this.publisher.publish(propertyAvailableEventArn, rdt))
      .thenReturn(rdt)
  }
}
