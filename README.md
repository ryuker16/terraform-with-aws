# terraform-firehose

terraform module that deploys a Firehose delivery stream with an ExtendedS3DestinationConfiguration by way of a CloudFormation Stack using Lambda as a custom resource

See http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Firehose.html#createDeliveryStream-property

## inputs

See the [vars.tf](vars.tf)

## outputs

DeliveryStreamName

DeliveryStreamArn

FirehoseStackId

## publishing

Unfortunately, we'll need to run `npm run minify` prior to submitting a release to ensure the 4096 character limit for AWS Lambda Function Code