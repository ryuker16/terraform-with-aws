export interface SplitBathRules {
  bathroom_map: { [index: string]: any }
}

export default function (options: SplitBathRules) {
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {
    if (!options.bathroom_map) {
      return callback(new Error('Attempting to split bath values without a map'))
    }

    let transformedValues = values.reduce(
      function (valueA, valueB) {
        let parts = valueB.split('.')
        let baths = parseInt(parts[0], 10)
        let halfBaths = parts[1] ? options.bathroom_map[parts[1]] : 0
        return valueA.concat([baths, halfBaths])
      },
      [])

    callback(null, transformedValues)
  }
}
