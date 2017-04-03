const config = require('config')
const AWS = require('aws-sdk')
AWS.config.update({
  region: config.get('region')
})
exports = module.exports = AWS
