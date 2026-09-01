variable "primary_domain" {
  description = "Canonical production hostname covered by ACM and routed to CloudFront."
  type        = string

  validation {
    condition = can(regex(
      "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$",
      var.primary_domain,
    ))
    error_message = "primary_domain must be a valid lowercase DNS hostname."
  }
}

variable "alternate_domains" {
  description = "Additional approved hostnames covered by the certificate and routed to CloudFront."
  type        = set(string)
  default     = []

  validation {
    condition = alltrue([
      for domain in var.alternate_domains : can(regex(
        "^(?:\\*\\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$",
        domain,
      ))
    ])
    error_message = "alternate_domains must contain only valid lowercase DNS names."
  }
}

variable "route53_zone_id" {
  description = "Authoritative public Route 53 hosted-zone ID approved for ALV records."
  type        = string

  validation {
    condition     = can(regex("^Z[A-Z0-9]+$", var.route53_zone_id))
    error_message = "route53_zone_id must be a Route 53 hosted-zone ID."
  }
}

variable "distribution_domain_name" {
  description = "CloudFront distribution hostname exported by the static-site module."
  type        = string

  validation {
    condition = can(regex(
      "^[a-z0-9]+\\.cloudfront\\.net$",
      var.distribution_domain_name,
    ))
    error_message = "distribution_domain_name must be a CloudFront hostname."
  }
}

variable "distribution_hosted_zone_id" {
  description = "CloudFront hosted-zone ID exported by the static-site module."
  type        = string

  validation {
    condition     = can(regex("^Z[A-Z0-9]+$", var.distribution_hosted_zone_id))
    error_message = "distribution_hosted_zone_id must be a hosted-zone ID."
  }
}

variable "tags" {
  description = "Required environment tags inherited from the live root."
  type        = map(string)
}
