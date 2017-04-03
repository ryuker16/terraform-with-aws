// source: [cell_phone, office_phone, fax]
// destination: [cell_phone, office_phone, fax]

function formatPhoneNumber(phone: String) {
  let normPhone = phone.replace(/[^0-9]/g, '')
  if (normPhone.length === 11) {
    return '+' + normPhone
  } else if (normPhone.length === 10) {
    return '+1' + normPhone
  } else {
    return ''
  }
}

export default function () {
  return (values: string[], callback: (err: Error, values?: any[]) => void) => {
    let transformedValues = values.map(formatPhoneNumber)
    callback(null, transformedValues)
  }
}
