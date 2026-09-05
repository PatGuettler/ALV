variable "bucket_name" {
  description = "Globally unique private origin bucket for the public Astro build."
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

variable "aws_account_id" {
  description = "Twelve-digit account that owns the origin and CloudFront distribution."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must contain exactly 12 digits."
  }
}

variable "origin_access_control_name" {
  description = "Unique name for the CloudFront origin access control."
  type        = string

  validation {
    condition     = length(trimspace(var.origin_access_control_name)) >= 3
    error_message = "origin_access_control_name must be supplied."
  }
}

variable "access_log_bucket_name" {
  description = "Existing dedicated central S3 access-log bucket."
  type        = string

  validation {
    condition     = var.access_log_bucket_name != var.bucket_name
    error_message = "The origin bucket cannot write access logs to itself."
  }
}

variable "access_log_prefix" {
  description = "Prefix for S3 server access logs from the origin bucket."
  type        = string
  default     = "s3-access/web-origin/"

  validation {
    condition     = length(trimspace(var.access_log_prefix)) > 0
    error_message = "access_log_prefix must not be empty."
  }
}

variable "cloudfront_log_bucket_domain_name" {
  description = "S3 bucket domain that receives CloudFront standard logs."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.s3\\.amazonaws\\.com$", var.cloudfront_log_bucket_domain_name))
    error_message = "cloudfront_log_bucket_domain_name must be an S3 bucket domain name."
  }
}

variable "cloudfront_log_prefix" {
  description = "Prefix for CloudFront standard logs."
  type        = string
  default     = "cloudfront/web/"

  validation {
    condition     = length(trimspace(var.cloudfront_log_prefix)) > 0
    error_message = "cloudfront_log_prefix must not be empty."
  }
}

variable "deployment_role_arns" {
  description = "IAM roles permitted to upload release objects. Must not include wildcard principals."
  type        = list(string)

  validation {
    condition = (
      length(var.deployment_role_arns) >= 1 &&
      alltrue([
        for arn in var.deployment_role_arns : can(regex("^arn:aws:iam::[0-9]{12}:role/.+", arn))
      ])
    )
    error_message = "deployment_role_arns must contain one or more IAM role ARNs."
  }
}

variable "web_acl_id" {
  description = "CloudFront-scope WAFv2 web ACL ARN from the edge-security module."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:wafv2:us-east-1:[0-9]{12}:global/webacl/.+", var.web_acl_id))
    error_message = "web_acl_id must be a CloudFront-scope WAFv2 ARN."
  }
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic for CloudFront 4xx and 5xx alarms."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:sns:[a-z0-9-]+:[0-9]{12}:.+$", var.alarm_sns_topic_arn))
    error_message = "alarm_sns_topic_arn must be an SNS topic ARN."
  }
}

variable "noncurrent_version_retention_days" {
  description = "Days to keep previous origin object versions for rollback."
  type        = number
  default     = 30

  validation {
    condition     = var.noncurrent_version_retention_days >= 7 && var.noncurrent_version_retention_days <= 365
    error_message = "noncurrent_version_retention_days must be between 7 and 365."
  }
}

variable "price_class" {
  description = "CloudFront price class. PriceClass_All uses the global edge network."
  type        = string
  default     = "PriceClass_All"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "price_class must be PriceClass_100, PriceClass_200, or PriceClass_All."
  }
}

variable "aliases" {
  description = "Optional public hostnames. Empty keeps the CloudFront default certificate until DNS cutover."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "Optional us-east-1 ACM certificate ARN used when aliases are set."
  type        = string
  default     = ""

  validation {
    condition = (
      var.acm_certificate_arn == "" ||
      can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/.+", var.acm_certificate_arn))
    )
    error_message = "acm_certificate_arn must be empty or a us-east-1 ACM certificate ARN."
  }
}

variable "content_security_policy" {
  description = "Content-Security-Policy header applied to every public site response."
  type        = string
  default     = "default-src 'self' https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"

  validation {
    condition     = strcontains(var.content_security_policy, "object-src 'none'")
    error_message = "content_security_policy must disable object-src plugins."
  }
}

variable "tags" {
  description = "Required environment tags inherited from the live root."
  type        = map(string)
}
