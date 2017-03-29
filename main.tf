variable "DeliveryStreamName" {
  description = "Name of the Firehose delivery stream"
}

resource "aws_cloudformation_stack" "firehose_stack" {
  # https://www.terraform.io/docs/providers/aws/r/cloudformation_stack.html
  parameters {
    DeliveryStreamName = "${var.DeliveryStreamName}"
    FunctionCode       = "${file("${path.module}/src/index.js")}"
  }

  template_body = "${file("${path.module}/stack.yaml")}"
}
