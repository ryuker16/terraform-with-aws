var AWS = require('aws-sdk');
var response = require('cfn-response');
exports.handler = function (event, context) {
  console.log('REQUEST RECEIVED');
  console.log(event);
  var firehose = new AWS.Firehose();
  var succeed = function (data) {
    console.log(data);
    response.send(event, context, response.SUCCESS, data);
  };
  var fail = function (err) {
    console.log(err, err.stack); // an error occurred
    response.send(event, context, response.FAILED, err);
  };
  var params = {
    DeliveryStreamName: event.ResourceProperties.DeliveryStreamName,
    ExtendedS3DestinationConfiguration: {
      BucketARN: event.ResourceProperties.BucketARN,
      RoleARN: event.ResourceProperties.RoleARN,
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
        NoEncryptionConfig: 'NoEncryption'
      },
      Prefix: event.ResourceProperties.Prefix,
      ProcessingConfiguration: {
        Enabled: true,
        Processors: [
          {
            Type: 'Lambda',
            Parameters: [ 
              {
                ParameterName: 'LambdaArn',
                ParameterValue: event.ResourceProperties.LambdaArn
              }
            ]
          }
        ]
      },
      S3BackupMode: event.ResourceProperties.S3BackupModeEnabled
    }
  };

  if (event.ResourceProperties.NumberOfRetries > 0) {
    params.ExtendedS3DestinationConfiguration.ProcessingConfiguration.Processors[0].Parameters.push({
      ParameterName: 'NumberOfRetries',
      ParameterValue: event.ResourceProperties.NumberOfRetries
    });
  }
  if (event.ResourceProperties.S3BackupModeEnabled === 'Enabled') {
    var S3BackupConfiguration = {
      BucketARN: event.ResourceProperties.BackupBucketARN,
      RoleARN: event.ResourceProperties.RoleARN,
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
        NoEncryptionConfig: 'NoEncryption'
      },
      Prefix: event.ResourceProperties.BackupPrefix
    };
    // during an update we have params['ExtendedS3DestinationUpdate']['S3BackupUpdate']
    params.ExtendedS3DestinationConfiguration[event.RequestType === 'Update' ?  'S3BackupUpdate' : 'S3BackupConfiguration'] = S3BackupConfiguration;
  }
  if (event.RequestType === 'Create') {
    firehose.createDeliveryStream(params, function (err, data) {
      if (err) {
         fail(err);
      } else {
        succeed({'message': data});
      }
    });
  } else if (event.RequestType === 'Update') {
    var streamName = event.ResourceProperties.DeliveryStreamName;
    var listStreamProp = {
      'ExclusiveStartDeliveryStreamName': streamName.substring(0, streamName.length -1)
    };
    firehose.listDeliveryStreams(listStreamProp, function (err, listData) {
      function listMatch (nameArrayResults) {
        console.log(nameArrayResults);
        return streamName === nameArrayResults;
      }

      if (err) {
        fail(err);
      } else if (!listData.DeliveryStreamNames.length ||
        streamName !== listData.DeliveryStreamNames.find(listMatch)) {
          console.log(listData.DeliveryStreamNames);
        fail({"message" : listData.DeliveryStreamNames});
      } else {
        firehose.describeDeliveryStream({
          'DeliveryStreamName': streamName
        }, function (err, details) {
          if (err) {
            fail(err);
          } else {
            var updateParams = {
              DeliveryStreamName: params.DeliveryStreamName,
              ExtendedS3DestinationUpdate: params.ExtendedS3DestinationConfiguration,
              CurrentDeliveryStreamVersionId: details.DeliveryStreamDescription.VersionId,
              DestinationId: details.DeliveryStreamDescription.Destinations[0].DestinationId
            };
            firehose.updateDestination(updateParams, function (err, data) {
              if (err) {
                fail(err);
              } else {
                succeed(data);
              }
            });
          }
        });
      }
    });
  } else if (event.RequestType === 'Delete') {
    var deleteParams = {
      DeliveryStreamName: event.ResourceProperties.DeliveryStreamName
    };
    firehose.deleteDeliveryStream(deleteParams, function (err, data) {
      if (err) {
        fail(err);
      } else {
        succeed(data);
      }
    });
  } else {
succeed({'message':'no-op'});
return;
  }
};
