'use strict'
/**
 * https://github.com/ThoughtWorksStudios/node-aws-lambda
 */
module.exports = {
  lambdaConfig: {
    region: 'us-east-1',
    handler: 'index.handler',
    role: 'arn:aws:iam::752727858468:role/rets-lambda-transformer',
    functionName: `etl-rets-lambda-transformer`,
    timeout: 45,
    memorySize: 128
  }
}
