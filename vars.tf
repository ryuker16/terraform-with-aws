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
  default     = "firehose-logger-kinesis"
  description = "Name of the firehose delivery stream"
}

variable "Prefix" {
  default     = "test-"
  description = "name of the transformed documents s3 prefix"
}

variable "BucketARN" {
  default     = "arn:aws:s3:::etl-canonical-property"
  description = "Destination BucketARN of firehose transformed records"
}

variable "SizeInMBs" {
  description = "Default Size in Mbs"
  default     = 1
}

variable "IntervalInSeconds" {
  description = " = Default Interval in Seconds"
  default     = 60
}

variable "LogStreamName" {
  default     = "test-logs"
  description = "Name of the log stream inside our log group"
}

variable "LogGroupName" {
  default     = "firehose-logger-kinesis"
  description = "Name of log Group"
}

variable "BackupPrefix" {
  default     = "backup-"
  description = "S3 prefix of source record backups"
}

variable "BackupBucketARN" {
  default     = "arn:aws:s3:::etl-extract-rets15-extracted-documents"
  description = "Backup bucket of firehose source record backup"
}

variable "LambdaArn" {
  default     = "arn:aws:logs:us-east-1:752727858468:log-group:/aws/kinesisfirehose/firehose-logger-willy-kinesis"
  description = "Arn of the ExtendedS3DestinationConfiguration lambda, replace default AWS ID and log group name of your own"
}

variable "aws_account_id" {
  description = "Enter your AWS Account ID!"
}

variable "aws_region" {
  description = "Enter your AWS region!"
  default     = "us-east-1"
}
