import * as countries from '../data/countries'

export default function () {
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {
    let transformedValues = values.map(function (value) {
      return countries[value]
    })
    callback(null, transformedValues)
  }
}
