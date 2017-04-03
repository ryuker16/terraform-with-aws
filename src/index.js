var AWS = require('aws-sdk')
var response = require('cfn-response')
exports.handler = function (event, context) {
  console.log('REQUEST RECEIVED')
  console.log(event)
  var firehose = new AWS.Firehose()
  if (event.RequestType === 'Create' ||  event.RequestType === 'Update') {
    var params = {
      DeliveryStreamName: event.ResourceProperties.DeliveryStreamName,
      ExtendedS3DestinationConfiguration: {
        BucketARN: event.ResourceProperties.BucketARN, /* required */
        RoleARN: event.ResourceProperties.RoleARN, /* required */
        BufferingHints: {
          IntervalInSeconds: event.ResourceProperties.IntervalInSeconds,
          SizeInMBs: event.ResourceProperties.SizeInMBs
        },
        CloudWatchLoggingOptions: {
          Enabled: true,
          LogGroupName: event.ResourceProperties.LogGroupName,
          LogStreamName: event.ResourceProperties.LogStreamName
        },
        CompressionFormat: event.ResourceProperties.Compression_format,
        EncryptionConfiguration: {
          // KMSEncryptionConfig: {
          //   AWSKMSKeyARN: 'STRING_VALUE' /* required */
          // },
          NoEncryptionConfig: 'NoEncryption'
        },
        Prefix: event.ResourceProperties.Prefix,
        ProcessingConfiguration: {
          Enabled: true,
          Processors: [
            {
              Type: 'Lambda', /* required */
              Parameters: [
                {
                  ParameterName: event.ResourceProperties.LambdaArnName, /* required */
                  ParameterValue: event.ResourceProperties.LambdaArn /* required */
                },
                /* more items */
              ]
            },
            /* more items */
          ]
        },
        S3BackupConfiguration: {
          BucketARN: event.ResourceProperties.BackupBucketARN, /* required */
          RoleARN: event.ResourceProperties.RoleARN, /* required */
          BufferingHints: {
            IntervalInSeconds: event.ResourceProperties.IntervalInSeconds,
            SizeInMBs: event.ResourceProperties.SizeInMBs
          },
          CloudWatchLoggingOptions: {
            Enabled: true,
            LogGroupName: event.ResourceProperties.LogGroupName,
            LogStreamName: event.ResourceProperties.LogStreamName
          },
          CompressionFormat: event.ResourceProperties.Compression_format,
          EncryptionConfiguration: {
            // KMSEncryptionConfig: {
            //   AWSKMSKeyARN: 'STRING_VALUE' /* required */
            // },
            NoEncryptionConfig: 'NoEncryption'
          },
          Prefix: event.ResourceProperties.Prefix
        },
        S3BackupMode: event.ResourceProperties.Enabled
      }
    };

    if (event.ResourceProperties.NumberOfRetries > 0) {
      params.ProcessingConfiguration.Processors.push({
            ParameterName: 'NumberOfRetries', /* required */
            ParameterValue: event.ResourceProperties.NumberOfRetries /* required */
      })
    }

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
    let params = {
      DeliveryStreamName: event.ResourceProperties.DeliveryStreamName /* required */
    };
    firehose.deleteDeliveryStream(params, function(err, data) {
      if (err) {
        console.log(err, err.stack) // an error occurred
        response.send(event, context, response.FAILED, err)
      }
      else {
        console.log(data)           // successful response
      }
    });

  } else {
    response.send(event, context, response.SUCCESS)
    return
  }
}
