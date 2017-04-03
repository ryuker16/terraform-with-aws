interface ConcatOptions {
  separator: string
}
export default function (concatOptions?: ConcatOptions) {
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {
    // remove null or empty values so that additional separators are not added
    let filteredValues = values.filter(function (value) {
      return (value !== null) && (value !== undefined)
    })
    if (filteredValues.length > 0) {
      let separator = (concatOptions && concatOptions.separator) || ''
      let transformedValues = [filteredValues.join(separator)]
      callback(null, transformedValues)
    } else {
      callback(null, [''])
    }
  }
}
