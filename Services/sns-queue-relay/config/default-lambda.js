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
    // AccessDeniedException: Your access has been denied by EC2, please make sure your function execution role have permission to CreateNetworkInterface. 
    // EC2 Error Code: UnauthorizedOperation. EC2 Error Message: You are not authorized to perform this operation
    
    // TODO: Where do i get this?
    // role: 'arn:aws:iam::752727858468:role/property-persister-lambda',
    
    functionName: 'etl-sns-queue-relay',
    timeout: 300,
    memorySize: 512,
    // publish: true, // default: false,
    runtime: 'nodejs4.3', // default: 'nodejs4.3',
    vpc: {
      SecurityGroupIds: ['sg-9b0e66ff'],
      SubnetIds: ['subnet-fda662c1']
    }
  }
}
