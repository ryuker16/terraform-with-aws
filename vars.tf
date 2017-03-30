variable "aws_region" {
  default = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account id for placester, pl-internal, pl-staging, etc"
}

variable "Compression_format" {
  default     = "UNCOMPRESSED"
  description = "UNCOMPRESSED | GZIP | ZIP | Snappy"
}

variable "NumberOfRetries" {
  default     = "2"
  description = "Number of times to attempt after failure"
}

variable "Enabled" {
  default     = "True"
  description = "Boolean: determines whether to enable features"
}

variable "LogStreamName" {
  description = "Name of Log Stream"
}

variable "LogGroupName" {
  description = "Name of Log Group Name"
}

variable "DeliveryStreamName" {
  description = "Name of the firehose delivery stream"
}

variable "Prefix" {
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

variable "BackupPrefix" {
  description = "S3 prefix of source record backups"
}

variable "BackupBucketARN" {
  description = "Backup bucket of firehose source record backup"
}

variable "LambdaArn" {
  description = "Arn of the ExtendedS3DestinationConfiguration lambda"
}
