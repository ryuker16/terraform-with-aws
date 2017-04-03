resource "aws_iam_role" "firehose_delivery_role" {
  name               = "role-${var.DeliveryStreamName}"
  assume_role_policy = "${data.aws_iam_policy_document.assume_firehose_delivery_role.json}"
}

resource "aws_iam_policy" "firehose_delivery_role" {
  name = "policy-${var.DeliveryStreamName}"

  # path - (Optional, default "/") Path in which to create the policy. See IAM Identifiers for more information.
  path   = "/"
  policy = "${data.aws_iam_policy_document.firehose_delivery_role.json}"
}

resource "aws_iam_policy_attachment" "firehose_delivery_role" {
  name       = "attach-${aws_iam_policy.firehose_delivery_role.name}"
  roles      = ["${aws_iam_role.firehose_delivery_role.name}"]
  policy_arn = "${aws_iam_policy.firehose_delivery_role.arn}"
}

data "aws_iam_policy_document" "assume_firehose_delivery_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["firehose.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = ["${var.aws_account_id}"]
    }
  }
}

data "aws_iam_policy_document" "firehose_delivery_role" {
  statement {
    actions = [
      "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject",
    ]

    resources = [
      "${var.BucketARN}",
      "${var.BucketARN}/*",
      "${var.BackupBucketARN}",
      "${var.BackupBucketARN}/*",
    ]
  }

  statement {
    actions = [
      "lambda:InvokeFunction",
      "lambda:GetFunctionConfiguration",
    ]

    resources = ["${var.LambdaArn}"]
  }

  statement {
    # Either "Allow" or "Deny", to specify whether this statement allows or denies the given actions. The default is "Allow".
    effect    = "Allow"
    actions   = ["logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.firehose_log_group.arn}:log-stream:*"]
  }
}
