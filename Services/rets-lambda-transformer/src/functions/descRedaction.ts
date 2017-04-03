import * as allowedHtml from '../data/allowedHtml'
import * as sanitizeHtml from 'sanitize-html'

function redact(text: string) {
  // replace new lines, carriage returns, websites, emails, gender, skype metadata
  // this is specific redaction for listing descriptions
  text = sanitizeHtml(text, allowedHtml)
  text = text.replace(/\r/g, '')
  text = text.replace(/\n/g, '')
  text = text.replace(/\b [a-z0-9\._%\+\-]+@[a-z0-9\.\-]+\.(aero|arpa|asia|biz|cat|com|coop|edu|gov|info|int|jobs|mil|mobi|museum|name|net|org|pro|tel|travel|[a-z]{2})\b/gi, '')
  text = text.replace(/\b (http:\/\/|http:\/\/|www\.)?[a-z0-9\.\-]+\.(aero|arpa|asia|biz|cat|com|coop|edu|gov|info|int|jobs|mil|mobi|museum|name|net|org|pro|tel|travel|[a-z]{2})\b/gi, '')
  text = text.replace(/\b (boy|girl|man|woman|boys|girls|men|women)\b/gi, '')
  text = text.replace(/begin_of_the_skype_highlighting(.+)end_of_the_skype_highlighting/gi, '')
  return text
}

export default function () {
  return (values: string[], callback: (err: Error, values?: any[]) => void) => {
    let transformedValues = values.map(redact)
    callback(null, transformedValues)
  }
}
