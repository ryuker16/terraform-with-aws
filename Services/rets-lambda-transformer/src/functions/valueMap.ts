export default function(options: any) {
  return (values: any[], callback: (err: Error, values?: string[]) => void) => {
    let transformedValues = values.map(function(value) {
      // look up the value in the field map mapping
      return options[value]
    })
    callback(null, transformedValues)
  }
}
