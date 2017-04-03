function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default function () {
  return (values: string[], callback: (err: Error, values?: any[]) => void) => {
    let transformedValues = values.map(function (value) {
      return value.split(' ').map(capitalize).join(' ')
    })
    callback(null, transformedValues)
  }
}
