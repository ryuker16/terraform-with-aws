import BPromise = require('bluebird')
import * as AWS from 'aws-sdk'

export interface IDocumentStorage {
  getByKey<T>(bucket: string, key: string): BPromise<T>
  storeByKey<T>(document: T, bucket: string, key: string): BPromise<any>
}

export class DocumentStorage implements IDocumentStorage {

  constructor(public client: AWS.S3) { }

  getByKey(bucket: string, key: string) {
    let s3params = {
      Bucket: bucket,
      Key: key
    }
    return BPromise.resolve(this.client.getObject(s3params).promise())
      .then((doc: { Body: string }) => {
        return JSON.parse(doc.Body)
      })
  }

  storeByKey<T>(document: T, bucket: string, key: string): BPromise<any> {
    let params = {
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(document)
    }
    return BPromise.resolve(this.client.putObject(params).promise())
  }
}
