provider "aws" {}

resource "aws_cloudformation_stack" "firehose_test_stack" {
  name = "firehose-stack-${var.DeliveryStreamName}"

  # https://www.terraform.io/docs/providers/aws/r/cloudformation_stack.html
  parameters {
    DeliveryStreamName  = "${var.DeliveryStreamName}"
    RoleARN             = "${aws_iam_role.firehose_delivery_role.arn}"
    Prefix              = "${var.Prefix}"
    LogStreamName       = "${aws_cloudwatch_log_stream.firehose_log_stream.name}"
    LogGroupName        = "${aws_cloudwatch_log_group.firehose_log_group.name}"
    BackupPrefix        = "${var.BackupPrefix}"
    BucketARN           = "${var.BucketARN}"
    BackupBucketARN     = "${var.BackupBucketARN}"
    LambdaArn           = "${var.LambdaArn}:${var.LambdaVersion}"
    NumberOfRetries     = "${var.NumberOfRetries}"
    S3BackupModeEnabled = "${var.S3BackupModeEnabled}"
    CompressionFormat   = "${var.CompressionFormat}"
    SizeInMBs           = "${var.SizeInMBs}"
    IntervalInSeconds   = "${var.IntervalInSeconds}"
    FunctionCode        = "${file("${path.module}/src/index.js")}"
  }

  capabilities = ["CAPABILITY_IAM"]

  template_body = "${file("${path.module}/stack.yml")}"
}

resource "aws_cloudwatch_log_group" "firehose_log_group" {
  name = "/aws/kinesisfirehose/${var.DeliveryStreamName}"
}

# log stream for both the Delivery and Backup
resource "aws_cloudwatch_log_stream" "firehose_log_stream" {
  name           = "delivery-${var.DeliveryStreamName}"
  log_group_name = "${aws_cloudwatch_log_group.firehose_log_group.name}"
}

output "FirehoseDeliveryRoleArn" {
  value = "${aws_iam_role.firehose_delivery_role.arn}"
}

output "LogGroupArn" {
  value = "${aws_cloudwatch_log_group.firehose_log_group.arn}"
}

output "FirehoseStackId" {
  value = "${aws_cloudformation_stack.firehose_test_stack.id}"
}
