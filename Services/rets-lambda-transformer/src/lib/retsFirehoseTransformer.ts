import { Lambda, SNS } from 'aws-sdk'
import * as BPromise from 'bluebird'
import { Contracts, IQueueMessage, HashMap, Context, Legacy } from 'etl'
import { DocumentTransformer } from './documentTransformer'
import { FirehoseTransformerFactory, FirehoseTransformer, TransformationResult } from './firehoseTransformer'
import { Aws } from 'infrastructure-node-cloudservices-lib'
import { ILogger } from 'infrastructure-logging-lib'
import * as config from 'config'
import * as _ from 'lodash'
import { DocumentTransformerFactory } from './retsLambdaTransformer'

export class RetsFirehoseTransformer {
  firehoseTransformer: FirehoseTransformer<Contracts.RetsDocumentExtracted, Contracts.RetsDocumentTransformed>

  constructor(
    private logger: ILogger,
    private documentTransformerFactory?: DocumentTransformerFactory,
    firehoseTransformerFactory?: typeof FirehoseTransformerFactory
  ) {
    if (!documentTransformerFactory) {
      this.documentTransformerFactory = function (data) {
        return new DocumentTransformer(data)
      }
    }
    if (!_.isFunction(firehoseTransformerFactory)) {
      firehoseTransformerFactory = FirehoseTransformerFactory
    }
    this.firehoseTransformer = firehoseTransformerFactory<Contracts.RetsDocumentExtracted, Contracts.RetsDocumentTransformed>(
      this.transformationHandler.bind(this)
    )
  }

  run(event: AwsContracts.FirehoseRecords): BPromise<AwsContracts.FirehoseProcessedRecords> {
    return BPromise.try(() => this.firehoseTransformer.processFirehoseRecords(event))
  }

  transformationHandler(rde: Contracts.RetsDocumentExtracted): BPromise<TransformationResult<Contracts.RetsDocumentTransformed>> {
    return BPromise.bind(this)
      .then(() => this.transformRetsDocumentExtracted(rde))
      .then((rdt: Contracts.RetsDocumentTransformed) => {
        // return the TransformationResult { data: RetsDocumentTransformed }
        return { data: rdt }
      })
      .catch(function (err) {
        this.logger.error(err, _.extend(
          { method: 'RetsFirehoseTransformer.transformRetsDocumentExtracted' },
          rde.context))
        throw err
      })
  }

  transformRetsDocumentExtracted(rde: Contracts.RetsDocumentExtracted): BPromise<Contracts.RetsDocumentTransformed> {
    return BPromise.bind(this)
      .then(() => rde.retsDocumentBody)
      .then((retsDocumentBody) => this.ensureRetsDocumentImages(rde, retsDocumentBody))
      .then((retsDocumentBody) => this.documentTransformerFactory(retsDocumentBody))
      .then((documentTransformer) => this.transformRetsDocument(rde, documentTransformer))
      .then((listing) => this.buildRetsDocumentTransformed(rde, listing))
  }

  buildRetsDocumentTransformed(rde: Contracts.RetsDocumentExtracted, listing: Legacy.Listings.Listing): Contracts.RetsDocumentTransformed {
    return _.assign(
      _.omit<Partial<Contracts.RetsDocumentExtracted>, Contracts.RetsDocumentExtracted>(
        rde,
        ['retsDocumentBody', 'transformManifest']
      ),
      { transformedDocumentBody: listing }
    ) as Contracts.RetsDocumentTransformed
  }

  /**
   * Transformation of retsDocumentImages happens in the enrich() function
   * that applies the normalize_images transformation function
   */
  ensureRetsDocumentImages(rde: Contracts.RetsDocumentExtracted, doc: any): any {
    if (doc && !_.isArrayLike(doc.images) && rde.retsDocumentImages) {
      doc.images = rde.retsDocumentImages
    }
    return doc
  }

  /**
   * transform, enrich, and hyrdate a DocumentTransformer of source RetsDocument
   * and supply it the listing (aka property) transformManifest
   */
  transformRetsDocument(rde: Contracts.RetsDocumentExtracted, documentTransformer: DocumentTransformer): BPromise<Legacy.Listings.Listing> {
    return documentTransformer.transform(rde.transformManifest.listing)
      .then(function (transformedDoc: DocumentTransformer) {
        transformedDoc.set('import_id', rde.config.importId)
        transformedDoc.set('provider_id', rde.config.providerId)
        transformedDoc.set('purchase_types', [rde.purchaseType])
        // enrich the transformed document HashMap with static enrichment functions
        return transformedDoc.enrich()
      })
      .then(function (enrichedDoc: DocumentTransformer) {
        // hydrate the attributes HashMap of [dotPath] => value to a full canaonical listing object
        return enrichedDoc.hydrate<Legacy.Listings.Listing>()
      })
  }
}
