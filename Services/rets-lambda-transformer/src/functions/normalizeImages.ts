import * as _ from 'lodash'
import { Rets, Legacy } from 'etl'
import { TransformerFactoryOf } from '../lib/documentTransformer'
/**
 * Translate a RetsImageResponse to the placester canonical image format
 */
function normalizeImage(image: any): Partial<Legacy.Listings.Image> {
  // the difference between the responses seems to be where the description/caption is found
  // the rets-client that fetches images camelizes the fields of the object
  if (image && image.headerInfo) {
    return {
      original_url: image.headerInfo.location || '',
      order: image.headerInfo.objectId || '0',
      caption: image.headerInfo.contentDescription || ''
    }
  } else {
    return image
  }
}

// input to this functions is expected to be an array of images, where images is an array of image objects
// ex: [[{headerInfo: {location: '', objectId: ''}}]]
export default function () {
  return (values: Rets.RetsImageResponse[][], callback: (err: Error, values?: Partial<Legacy.Listings.Image>[][]) => void) => {
    let transformedValues = _.map(values, function (imagesArray) {
      return _.map(imagesArray, normalizeImage)
    })
    callback(null, transformedValues)
  }
}
