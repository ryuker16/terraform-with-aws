import * as states from '../data/states'

export default function () {
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {
    let transformedValues = values.map(function (value) {
      return states[value]
    })
    callback(null, transformedValues)
  }
}
