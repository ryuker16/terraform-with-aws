import * as _ from 'lodash'
import { HashMap } from 'etl'

export interface SuffixRules {
  value: string
}

let isValid = function (value: any) {
  return !_.isNil(value)
}

export default function (options: SuffixRules, doc: HashMap) {
  return (values: any[], callback: (err: Error, values?: string[]) => void) => {
    if (!options.value) {
      return callback(new Error('Attempting to suffix without valid parameters'))
    }

    let transformedValues = _.map(values, function (value) {
      if (isValid(value) && isValid(doc[options.value])) {
        return [value, doc[options.value]].join(' ')
      }
      if (!isValid(value) && isValid(doc[options.value])) {
        return doc[options.value]
      }
      if (isValid(value) && !isValid(doc[options.value])) {
        return value
      }
      return ''
    })
    callback(null, transformedValues)
  }
}
