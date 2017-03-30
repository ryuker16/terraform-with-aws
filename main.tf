provider "aws" {
  region = "${var.aws_region}"
}

resource "aws_cloudformation_stack" "firehose_stack" {
  # https://www.terraform.io/docs/providers/aws/r/cloudformation_stack.html
  parameters {
    DeliveryStreamName = "${var.DeliveryStreamName}"
    RoleARN            = "${aws_iam_role.firehose_delivery_role.arn}"
    Prefix             = "${var.Prefix}"
    LogStreamName      = "${var.LogStreamName}"
    LogGroupName       = "${var.LogGroupName}"
    BackupPrefix       = "${var.BackupPrefix}"
    BucketARN          = "${aws_s3_bucket.property_canonical_bucket.arn}"
    BackupBucketARN    = "${aws_s3_bucket.property_extracted_bucket.arn}"
    LambdaArn          = "${aws_lambda_function.transformer.arn}"
    NumberOfRetries    = "${var.NumberOfRetries}"
    Enabled            = "${var.Enabled}"
    Compression_format = "${var.Compression_format}"

    BufferingHints = {
      SizeInMBs         = "${var.SizeInMBs}"
      IntervalInSeconds = "${var.IntervalInSeconds}"
    }

    FunctionCode = "${file("${path.module}/src/index.js")}"
  }

  template_body = "${file("${path.module}/stack.yaml")}"
  policy_body   = "${file("${path.module}/templates/firehose_delivery_role.json")}"
}
