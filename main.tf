provider "aws" {}

/*data "template_file" "firehose_delivery_role" {
  template = "${file("${path.module}/templates/firehose_delivery_role.json")}"

  vars {
    LambdaArn       = "${var.LambdaArn}"
    BackupPrefix    = "${var.BackupPrefix}"
    BucketARN       = "${var.BucketARN}"
    BackupBucketARN = "${var.BackupBucketARN}"
    LogGroupArn     = "${var.LogGroupArn}"
  }
}*/

resource "aws_cloudformation_stack" "firehose_test_stack" {
  name = "firehose-stack"

  # https://www.terraform.io/docs/providers/aws/r/cloudformation_stack.html
  parameters {
    DeliveryStreamName = "${var.DeliveryStreamName}"
    RoleARN            = "${aws_iam_role.firehose_delivery_role.arn}"
    Prefix             = "${var.Prefix}"
    LogStreamName      = "${var.LogStreamName}"
    LogGroupName       = "${var.LogGroupName}"
    BackupPrefix       = "${var.BackupPrefix}"
    BucketARN          = "${var.BucketARN}"
    BackupBucketARN    = "${var.BackupBucketARN}"
    LambdaArn          = "${var.LambdaArn}"
    NumberOfRetries    = "${var.NumberOfRetries}"
    Enabled            = "${var.Enabled}"
    CompressionFormat  = "${var.CompressionFormat}"

    # BufferingHints = {
    SizeInMBs         = "${var.SizeInMBs}"
    IntervalInSeconds = "${var.IntervalInSeconds}"

    # }

    FunctionCode = "${file("${path.module}/src/index.js")}"
  }

  template_body = "${file("${path.module}/stack.yml")}"

  #policy_body = "${data.aws_iam_policy_document.firehose_delivery_role.json}"
}
