import * as _ from 'lodash'
/**
 * source: ['cur_data/sqft_range']
 * destination: ['sqft_min', 'sqft_max', 'sqft']
 */
export default function() {
  return (values: string[], callback: (err: Error, values: any[]) => void) => {
    if (!values || !values.length) {
      return callback(null, [])
    }
    let rangeArray = (_.head(values) || '').split('-', 2)
    let min = parseInt(rangeArray[0].trim(), 10)
    let max = parseInt((rangeArray[1] || '').trim(), 10)
    let average = (min + max) / 2
    let transformedValues = [min, max, average]
    return callback(null, transformedValues)
  }
}
