export default function() {
  return (values: string[], callback: (err: Error, values?: any[]) => void) => {
    let transformedValues = values.map(function(value) {
      return value.toLowerCase()
    })
    callback(null, transformedValues)
  }
}
