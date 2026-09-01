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

variable "aws_account_id" {
  description = "Twelve-digit account that owns the origin and approved CloudFront distribution."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must contain exactly 12 digits."
  }
}

variable "distribution_name" {
  description = "Environment-specific prefix for the distribution and edge policies."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,32}$", var.distribution_name))
    error_message = "distribution_name must contain 3-32 lowercase letters, digits, or hyphens."
  }
}

variable "origin_access_control_name" {
  description = "Environment-specific CloudFront Origin Access Control name."
  type        = string

  validation {
    condition = (
      length(trimspace(var.origin_access_control_name)) >= 3 &&
      length(var.origin_access_control_name) <= 64
    )
    error_message = "origin_access_control_name must contain 3-64 characters."
  }
}

variable "domain_aliases" {
  description = "Approved production hostnames attached to the CloudFront distribution."
  type        = set(string)

  validation {
    condition = (
      length(var.domain_aliases) > 0 &&
      alltrue([
        for alias in var.domain_aliases : can(
          regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", alias),
        )
      ])
    )
    error_message = "domain_aliases must contain one or more valid lowercase DNS names."
  }
}

variable "acm_certificate_arn" {
  description = "Issued us-east-1 ACM certificate covering every domain alias."
  type        = string

  validation {
    condition = can(regex(
      "^arn:aws:acm:us-east-1:[0-9]{12}:certificate/[0-9a-f-]+$",
      var.acm_certificate_arn,
    ))
    error_message = "acm_certificate_arn must be an ACM certificate ARN from us-east-1."
  }
}

variable "web_acl_arn" {
  description = "Approved CloudFront-scope WAFv2 web ACL ARN provisioned by issue #84."
  type        = string

  validation {
    condition = can(regex(
      "^arn:aws:wafv2:us-east-1:[0-9]{12}:global/webacl/[A-Za-z0-9_-]+/[0-9a-f-]+$",
      var.web_acl_arn,
    ))
    error_message = "web_acl_arn must be a global CloudFront WAFv2 web ACL ARN."
  }
}

variable "cloudfront_log_bucket_domain_name" {
  description = "Dedicated legacy-ACL-compatible S3 log bucket domain name provisioned by issue #84."
  type        = string

  validation {
    condition = can(regex(
      "^[a-z0-9][a-z0-9.-]+\\.s3\\.amazonaws\\.com$",
      var.cloudfront_log_bucket_domain_name,
    ))
    error_message = "cloudfront_log_bucket_domain_name must be an S3 bucket domain name."
  }
}

variable "cloudfront_log_prefix" {
  description = "Environment-specific prefix for CloudFront standard logs."
  type        = string
  default     = "cloudfront/"

  validation {
    condition     = length(trimspace(var.cloudfront_log_prefix)) > 0
    error_message = "cloudfront_log_prefix must not be empty."
  }
}

variable "content_security_policy" {
  description = "Customer-approved CSP covering the site's explicit external integrations."
  type        = string

  validation {
    condition = (
      length(trimspace(var.content_security_policy)) > 0 &&
      strcontains(lower(var.content_security_policy), "default-src")
    )
    error_message = "content_security_policy must define at least a default-src directive."
  }
}

variable "price_class" {
  description = "Approved CloudFront price class."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "price_class must be a supported CloudFront price class."
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
