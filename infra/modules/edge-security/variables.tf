variable "name" {
  description = "Environment-specific lowercase name for edge protection resources."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,32}$", var.name))
    error_message = "name must contain 3-32 lowercase letters, digits, or hyphens."
  }
}

variable "aws_account_id" {
  description = "Twelve-digit account that owns the ALV edge resources."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must contain exactly 12 digits."
  }
}

variable "edge_log_bucket_name" {
  description = "Globally unique private bucket name for CloudFront standard logs."
  type        = string

  validation {
    condition = (
      length(var.edge_log_bucket_name) >= 3 &&
      length(var.edge_log_bucket_name) <= 63 &&
      can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.edge_log_bucket_name))
    )
    error_message = "edge_log_bucket_name must be a valid 3-63 character lowercase S3 bucket name."
  }
}

variable "access_log_bucket_name" {
  description = "Existing dedicated central S3 access-log bucket."
  type        = string

  validation {
    condition     = var.access_log_bucket_name != var.edge_log_bucket_name
    error_message = "The edge log bucket cannot write S3 access logs to itself."
  }
}

variable "access_log_prefix" {
  description = "Environment-specific prefix for S3 access logs from the edge log bucket."
  type        = string
  default     = "s3-access/edge-logs/"

  validation {
    condition     = length(trimspace(var.access_log_prefix)) > 0
    error_message = "access_log_prefix must not be empty."
  }
}

variable "rate_limit_requests" {
  description = "Maximum requests from one IP in the five-minute WAF evaluation window."
  type        = number
  default     = 2000

  validation {
    condition     = var.rate_limit_requests >= 100 && var.rate_limit_requests <= 20000000
    error_message = "rate_limit_requests must be between 100 and 20,000,000."
  }
}

variable "edge_log_retention_days" {
  description = "Days to retain CloudFront standard logs."
  type        = number
  default     = 90

  validation {
    condition     = var.edge_log_retention_days >= 30 && var.edge_log_retention_days <= 365
    error_message = "edge_log_retention_days must be between 30 and 365."
  }
}

variable "waf_log_retention_days" {
  description = "CloudWatch retention for redacted WAF request logs."
  type        = number
  default     = 365

  validation {
    condition     = contains([30, 60, 90, 120, 150, 180, 365], var.waf_log_retention_days)
    error_message = "waf_log_retention_days must be an AWS-supported value from 30 through 365 days."
  }
}

variable "tags" {
  description = "Required environment tags inherited from the live root."
  type        = map(string)
}
