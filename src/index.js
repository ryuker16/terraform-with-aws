var AWS = require('aws-sdk');
var response = require('cfn-response');
exports.handler = function (event, context) {
  console.log('REQUEST RECEIVED');
  console.log(event);
  var firehose = new AWS.Firehose();
  if (event.RequestType === 'Create') {
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
        CompressionFormat: event.ResourceProperties.CompressionFormat,
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
                  ParameterName: 'LambdaArn', /* required */
                  ParameterValue: event.ResourceProperties.LambdaArn /* required */
                }
                /* more items */
              ]
            }
            /* more items */
          ]
        },
        S3BackupMode: event.ResourceProperties.S3BackupModeEnabled
      }
    };

    if (event.ResourceProperties.NumberOfRetries > 0) {
      params.ExtendedS3DestinationConfiguration.ProcessingConfiguration.Processors.push({
        ParameterName: 'NumberOfRetries', /* required */
        ParameterValue: event.ResourceProperties.NumberOfRetries /* required */
      });
    }

    if (event.ResourceProperties.S3BackupModeEnabled === 'Enabled') {
      params.ExtendedS3DestinationConfiguration.S3BackupConfiguration = {
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
        CompressionFormat: event.ResourceProperties.CompressionFormat,
        EncryptionConfiguration: {
          // KMSEncryptionConfig: {
          //   AWSKMSKeyARN: 'STRING_VALUE' /* required */
          // },
          NoEncryptionConfig: 'NoEncryption'
        },
        Prefix: event.ResourceProperties.BackupPrefix
      };
    }

    firehose.createDeliveryStream(params, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        response.send(event, context, response.FAILED, err);
      }
      else {
        console.log(data);           // successful response
        response.send(event, context, response.SUCCESS, data);
      }
    });
  } else if (event.RequestType === 'Delete') {
    var params = {
      DeliveryStreamName: event.ResourceProperties.DeliveryStreamName /* required */
    };
    firehose.deleteDeliveryStream(params, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        response.send(event, context, response.FAILED, err);
      }
      else {
        console.log(data);           // successful response
        response.send(event, context, response.SUCCESS, data);
      }
    });
  } else {
    response.send(event, context, response.SUCCESS, 'no-op');
    return;
  }
};
