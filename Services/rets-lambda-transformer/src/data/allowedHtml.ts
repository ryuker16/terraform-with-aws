const allowedHtml = {
  allowedTags: ['br', 'b', 'strong', 'table', 'td',
    'tr', 'em', 'i', 'blockquote', 'span',
    'font', 'p', 'hr', 'h1', 'h2', 'h3'],
  allowedAttributes: {
    table: ['colspan', 'rowspan', 'style'],
    td: ['colspan', 'rowspan', 'style'],
    tr: ['colspan', 'rowspan', 'style'],
    span: ['style'],
    blockquote: ['style'],
    font: ['size', 'color'],
    i: ['style'],
    em: ['style'],
    p: ['style'],
    hr: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style']
  }
}
export = allowedHtml
