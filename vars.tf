variable "CompressionFormat" {
  default     = "UNCOMPRESSED"
  description = "UNCOMPRESSED | GZIP | ZIP | Snappy"
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
  default     = "Test-Firehose"
  description = "name of the transformed documents s3 prefix"
}

variable "BucketARN" {
  description = "Destination BucketARN of firehose transformed records"
}

variable "SizeInMBs" {
  default = 1
}

variable "IntervalInSeconds" {
  default = 60
}

variable "LogGroupArn" {
  description = "test"
}

variable "BackupPrefix" {
  description = "S3 prefix of source record backups"
}

variable "BackupBucketARN" {
  description = "Backup bucket of firehose source record backup"
}

variable "LambdaArn" {
  description = "Arn of the ExtendedS3DestinationConfiguration lambda"
}

variable "aws_account_id" {
  description = "Enter your AWS Account ID!"
}

variable "aws_region" {
  description = "Enter your AWS region!"
  default     = "us-east-1"
}
