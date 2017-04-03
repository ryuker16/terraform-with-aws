import * as _ from 'lodash'

interface SoldStatuses {
  sold_statuses: string[]
}
// setStatus gets an optional sold_statuses. If the option is provided, it returns the given status followed
// by the Placester active or closed
// if the option is not provided, it returns what it was given
export default function (soldStatuses?: SoldStatuses) {
  return (values: string[], callback: (err: Error, values?: string[]) => void) => {

    // if sold_statuses exists - set the status based on the sold_statuses
    // if no sold statuses and no cur_data.status - set status to be active
    let targets: string[] = []
    if (soldStatuses && soldStatuses.sold_statuses.length > 0) {
      _.forEach(values, function (value) {
        targets.push(value)
        if (_.includes(soldStatuses.sold_statuses, value)) {
          targets.push('closed')
        } else {
          targets.push('active')
        }
      })
      callback(null, targets)
    } else {
      callback(null, values)
    }
  }
}
