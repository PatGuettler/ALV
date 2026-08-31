variable "bucket_name" {
  description = "Globally unique private origin bucket name."
  type        = string

  validation {
    condition = (
      length(var.bucket_name) >= 3 &&
      length(var.bucket_name) <= 63 &&
      can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.bucket_name))
    )
    error_message = "bucket_name must be a valid 3-63 character lowercase S3 bucket name."
  }
}

variable "access_log_bucket_name" {
  description = "Existing dedicated S3 access-log bucket in the approved logging boundary."
  type        = string

  validation {
    condition     = var.access_log_bucket_name != var.bucket_name
    error_message = "The origin bucket cannot write access logs to itself."
  }
}

variable "access_log_prefix" {
  description = "Environment-specific prefix used for origin access logs."
  type        = string
  default     = "s3-access/origin/"

  validation {
    condition     = length(trimspace(var.access_log_prefix)) > 0
    error_message = "access_log_prefix must not be empty."
  }
}

variable "deployment_role_arns" {
  description = "Exact same-account GitHub deployment role ARNs permitted to modify site objects."
  type        = list(string)

  validation {
    condition = (
      length(var.deployment_role_arns) > 0 &&
      alltrue([
        for arn in var.deployment_role_arns : can(
          regex("^arn:aws:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn),
        )
      ])
    )
    error_message = "deployment_role_arns must contain one or more exact IAM role ARNs."
  }
}

variable "noncurrent_version_retention_days" {
  description = "Days to retain replaced/deleted object versions for rollback."
  type        = number
  default     = 90

  validation {
    condition     = var.noncurrent_version_retention_days >= 30
    error_message = "Retain noncurrent production objects for at least 30 days."
  }
}

variable "tags" {
  description = "Required environment tags inherited from the live root."
  type        = map(string)
}
