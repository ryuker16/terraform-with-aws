provider "aws" {
  region = "${var.aws_region}"
}

resource "aws_cloudformation_stack" "firehose" {
  name = "firehose-stack-${var.DeliveryStreamName}"

  # https://www.terraform.io/docs/providers/aws/r/cloudformation_stack.html
  parameters {
    DeliveryStreamName  = "${var.DeliveryStreamName}"
    RoleARN             = "${aws_iam_role.firehose.arn}"
    Prefix              = "${var.Prefix}"
    LogStreamName       = "${aws_cloudwatch_log_stream.firehose.name}"
    LogGroupName        = "${aws_cloudwatch_log_group.firehose.name}"
    BackupPrefix        = "${var.BackupPrefix}"
    BucketARN           = "${var.BucketARN}"
    BackupBucketARN     = "${var.BackupBucketARN}"
    LambdaArn           = "${var.LambdaArn}:${var.LambdaVersion}"
    NumberOfRetries     = "${var.NumberOfRetries}"
    S3BackupModeEnabled = "${var.S3BackupModeEnabled}"
    CompressionFormat   = "${var.CompressionFormat}"
    SizeInMBs           = "${var.SizeInMBs}"
    IntervalInSeconds   = "${var.IntervalInSeconds}"
    FunctionCode        = "${file("${path.module}/src/index.min.js")}"
  }

  capabilities = ["CAPABILITY_IAM"]

  template_body = "${file("${path.module}/stack.yml")}"
}

resource "aws_cloudwatch_log_group" "firehose" {
  name = "/aws/kinesisfirehose/${var.DeliveryStreamName}"
}

# log stream for both the Delivery and Backup
resource "aws_cloudwatch_log_stream" "firehose" {
  depends_on     = ["aws_cloudwatch_log_group.firehose"]
  name           = "delivery-${var.DeliveryStreamName}"
  log_group_name = "${aws_cloudwatch_log_group.firehose.name}"
}

output "FirehoseDeliveryRoleArn" {
  value = "${aws_iam_role.firehose.arn}"
}

output "LogGroupName" {
  value = "${aws_cloudwatch_log_group.firehose.name}"
}

output "LogGroupArn" {
  value = "${aws_cloudwatch_log_group.firehose.arn}"
}

output "FirehoseStackId" {
  value = "${aws_cloudformation_stack.firehose.id}"
}

output "DeliveryStreamName" {
  value = "${var.DeliveryStreamName}"
}

output "DeliveryStreamArn" {
  value = "arn:aws:firehose:${var.aws_region}:${var.aws_account_id}:deliverystream/${var.DeliveryStreamName}"
}
