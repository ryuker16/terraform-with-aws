import * as _ from 'lodash'

export default function () {
  // assumes values is either ['closed'] or ['active']
  // source is status, target is deleted_at
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {
    let deletedAtArray: string[] = []
    _.forEach(values, function (value) {
      if (value === 'closed') {
        deletedAtArray.push(new Date().toUTCString()) // date needs to be in UTC
      } else {
        deletedAtArray.push(undefined) // skip this
      }
    })
    callback(null, deletedAtArray)
  }
}
