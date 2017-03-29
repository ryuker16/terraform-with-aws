var AWS = require('aws-sdk')
var response = require('cfn-response')
exports.handler = function (event, context) {
  console.log('REQUEST RECEIVED')
  console.log(event)
  var firehose = new AWS.Firehose()
  if (event.RequestType == 'Create') {
    var params = {
      DeliveryStreamName: event.ResourceProperties.DeliveryStreamName
      ExtendedS3DestinationConfiguration: {
        BucketARN: 'STRING_VALUE', /* required */
        RoleARN: 'STRING_VALUE', /* required */
        BufferingHints: {
          IntervalInSeconds: 0,
          SizeInMBs: 0
        },
        CloudWatchLoggingOptions: {
          Enabled: true || false,
          LogGroupName: 'STRING_VALUE',
          LogStreamName: 'STRING_VALUE'
        },
        CompressionFormat: 'UNCOMPRESSED | GZIP | ZIP | Snappy',
        EncryptionConfiguration: {
          KMSEncryptionConfig: {
            AWSKMSKeyARN: 'STRING_VALUE' /* required */
          },
          NoEncryptionConfig: 'NoEncryption'
        },
        Prefix: 'STRING_VALUE',
        ProcessingConfiguration: {
          Enabled: true || false,
          Processors: [
            {
              Type: 'Lambda', /* required */
              Parameters: [
                {
                  ParameterName: 'LambdaArn | NumberOfRetries', /* required */
                  ParameterValue: 'STRING_VALUE' /* required */
                },
                /* more items */
              ]
            },
            /* more items */
          ]
        },
        S3BackupConfiguration: {
          BucketARN: 'STRING_VALUE', /* required */
          RoleARN: 'STRING_VALUE', /* required */
          BufferingHints: {
            IntervalInSeconds: 0,
            SizeInMBs: 0
          },
          CloudWatchLoggingOptions: {
            Enabled: true || false,
            LogGroupName: 'STRING_VALUE',
            LogStreamName: 'STRING_VALUE'
          },
          CompressionFormat: 'UNCOMPRESSED | GZIP | ZIP | Snappy',
          EncryptionConfiguration: {
            KMSEncryptionConfig: {
              AWSKMSKeyARN: 'STRING_VALUE' /* required */
            },
            NoEncryptionConfig: 'NoEncryption'
          },
          Prefix: 'STRING_VALUE'
        },
        S3BackupMode: 'Disabled | Enabled'
      }
    };
    firehose.createDeliveryStream(params, function (err, data) {
      if (err) {
        console.log(err, err.stack) // an error occurred
        response.send(event, context, response.FAILED, err)
      }
      else {
        console.log(data)           // successful response
        response.send(event, context, response.SUCCESS, data)
      }
    })
  } else if (event.RequestType == 'Delete') {
  } else {
    response.send(event, context, response.SUCCESS)
    return
  }
}
