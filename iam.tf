resource "aws_iam_role" "firehose" {
  name               = "role-${var.DeliveryStreamName}"
  assume_role_policy = "${data.aws_iam_policy_document.assume_firehose.json}"
}

resource "aws_iam_policy" "firehose" {
  name = "policy-${var.DeliveryStreamName}"

  # path - (Optional, default "/") Path in which to create the policy. See IAM Identifiers for more information.
  path   = "/"
  policy = "${data.aws_iam_policy_document.firehose.json}"
}

resource "aws_iam_policy_attachment" "firehose" {
  name       = "attach-${aws_iam_policy.firehose.name}"
  roles      = ["${aws_iam_role.firehose.name}"]
  policy_arn = "${aws_iam_policy.firehose.arn}"
}

data "aws_iam_policy_document" "assume_firehose" {
  statement {
    effect = "Allow"

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

data "aws_iam_policy_document" "firehose" {
  statement {
    effect = "Allow"

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
    effect = "Allow"

    actions = [
      "firehose:DescribeDeliveryStream",
      "firehose:ListDeliveryStreams",
      "firehose:CreateDeliveryStream",
      "firehose:UpdateDestination",
    ]

    effect    = "Allow"
    resources = ["${var.LambdaArn}"]
  }

  statement {
    actions = [
      "firehose:DescribeDeliveryStream",
      "firehose:ListDeliveryStreams",
      "firehose:CreateDeliveryStream",
      "firehose:UpdateDestination",
    ]

    effect    = "Allow"
    resources = ["${var.LambdaArn}"]
  }

  statement {
    actions = [
      "firehose:DescribeDeliveryStream",
      "firehose:ListDeliveryStreams",
      "firehose:CreateDeliveryStream",
      "firehose:UpdateDestination",
    ]

    effect    = "Allow"
    resources = ["${var.LambdaArn}"]
  }

  statement {
    actions = [
      "lambda:InvokeFunction",
      "lambda:GetFunctionConfiguration",
    ]

    resources = ["${var.LambdaArn}:${var.LambdaVersion}"]
  }

  statement {
    # Either "Allow" or "Deny", to specify whether this statement allows or denies the given actions. The default is "Allow".
    effect  = "Allow"
    actions = ["logs:PutLogEvents"]

    # note - aws_cloudwatch_log_group.arn returns :*
    resources = ["${aws_cloudwatch_log_group.firehose.arn}"]
  }
}
