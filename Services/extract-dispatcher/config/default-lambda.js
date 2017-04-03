'use strict'
/**
 * https://github.com/ThoughtWorksStudios/node-aws-lambda
 */
module.exports = {
  lambdaConfig: {
    //   accessKeyId: <access key id>,  // optional
    //   secretAccessKey: <secret access key>,  // optional
    //   sessionToken: <sessionToken for assuming roles>,  // optional
    //   profile: <shared credentials profile name>, // optional for loading AWS credientail from custom profile
    region: 'us-east-1',
    handler: 'index.handler',
    role: 'arn:aws:iam::752727858468:role/retsLambda',
    functionName: 'etl-extract-rets15-dispatcher',
    timeout: 150,
    // memorySize: 512
    // publish: true, // default: false,
    runtime: 'nodejs4.3', // default: 'nodejs4.3',
    vpc: {
      SecurityGroupIds: ['sg-9b0e66ff'],
      SubnetIds: ['subnet-fda662c1']
    }
  }
}
