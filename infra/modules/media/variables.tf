variable "name" {
  description = "Short unique prefix for media buckets, KMS, CloudFront, and alarms."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$", var.name))
    error_message = "name must be a 3-32 character lowercase prefix."
  }
}

variable "aws_account_id" {
  description = "Twelve-digit AWS account that owns the media buckets and KMS key."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be exactly 12 digits."
  }
}

variable "access_log_bucket_name" {
  description = "Existing dedicated access-log bucket. Must not be an originals or derivatives bucket."
  type        = string
}

variable "uploader_role_arn" {
  description = "IAM role permitted to write original objects. It cannot change bucket ACLs."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/.+", var.uploader_role_arn))
    error_message = "uploader_role_arn must be an IAM role ARN."
  }
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic for media 5xx and 4xx alarms."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:sns:[a-z0-9-]+:[0-9]{12}:.+$", var.alarm_sns_topic_arn))
    error_message = "alarm_sns_topic_arn must be an SNS topic ARN."
  }
}

variable "tags" {
  description = "Required environment tags inherited from the live root."
  type        = map(string)
}
