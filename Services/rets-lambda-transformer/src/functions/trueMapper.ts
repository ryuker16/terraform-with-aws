export default function (args: any) {
  return (values: string[], callback: (err: Error, values?: any[]) => void) => {
    let transformedValues = values.map(function (value) {
      if (args.value !== undefined && value.toLowerCase() === args.value.toLowerCase()) {
        return true
      } else {
        return false
      }
    })
    callback(null, transformedValues)
  }
}
