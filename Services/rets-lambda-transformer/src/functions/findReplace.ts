export interface SubstitutionRules {
  match: string,
  replace: string
}

export default function findReplace(options: SubstitutionRules) {
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {
    if (!options || !options.match || typeof options.replace === 'undefined') {
      return callback(new Error('Invalid configuration for string substitution'))
    }
    // Create regular expression for all instances of options.match
    let regex = new RegExp(options.match, 'g')
    let transformedValues = values.map(function (value) {
      // Replace options.match in the given value with options.replace
      return value && typeof value === 'string' ? value.replace(regex, options.replace) : value
    })

    callback(null, transformedValues)
  }
}
