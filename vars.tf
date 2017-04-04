variable "CompressionFormat" {
  default     = "UNCOMPRESSED"
  description = "UNCOMPRESSED | GZIP | ZIP | Snappy : Choose Compression format"
}

variable "NumberOfRetries" {
  default     = "2"
  description = "Number of times to attempt after failure"
}

variable "S3BackupModeEnabled" {
  default     = "Enabled"
  description = "Enabled|Disabled: determines whether to enable"
}

variable "DeliveryStreamName" {
  description = "Name of the firehose delivery stream"
}

variable "Prefix" {
  default     = "test-"
  description = "name of the transformed documents s3 prefix"
}

variable "BucketARN" {
  description = "Destination BucketARN of firehose transformed records"
}

# http://docs.aws.amazon.com/firehose/latest/APIReference/API_BufferingHints.html
variable "SizeInMBs" {
  description = "Buffer incoming data to the specified size, in MBs, before delivering it to the destination. The default value is 5."
  default     = 5
}

variable "IntervalInSeconds" {
  description = "Buffer incoming data for the specified period of time, in seconds, before delivering it to the destination. The default value is 300"
  default     = 300
}

variable "BackupPrefix" {
  default     = "backup-"
  description = "S3 prefix of source record backups"
}

variable "BackupBucketARN" {
  description = "Backup bucket of firehose source record backup"
}

variable "LambdaArn" {
  description = "Arn of the ExtendedS3DestinationConfiguration lambda, replace default AWS ID and log group name of your own"
}

variable "LambdaVersion" {
  default = "$LATEST"
}

variable "aws_account_id" {
  description = "Enter your AWS Account ID!"
}

variable "aws_region" {
  description = "Enter your AWS region!"
  default     = "us-east-1"
}
