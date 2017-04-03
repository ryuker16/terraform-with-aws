import * as BPromise from 'bluebird'
import * as AWS from 'aws-sdk'
import { ILogger } from 'etl'

export interface IDocumentRepo {
  getExtractedDocument<T>(bucket: string, key: string): BPromise<T>
  storeTransformedDocument(document: any, bucket: string, key: string): BPromise<any>
}

// handles getting extracted document to be transformed from s3
export class DocumentRepo implements IDocumentRepo {

  constructor(
    private client: AWS.S3,
    private logger: ILogger) { }

  getExtractedDocument(bucket: string, key: string) {
    let s3params = {
      Bucket: bucket,
      Key: key
    }

    return BPromise.bind(this)
      .then(() => {
        return this.client.getObject(s3params).promise()
      })
      .then((doc: { Body: string }) => {
        return JSON.parse(doc.Body)
      })
      .catch((err: Error) => {
        this.logger.error(err)
        throw err
      })
  }

  storeTransformedDocument(document: any, bucket: string, key: string): BPromise<any> {
    let params = {
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(document)
    }

    return BPromise.bind(this)
      .then(() => {
        return this.client.putObject(params).promise()
      })
      .catch((err: Error) => {
        this.logger.error(err)
        throw err
      })
  }
}
