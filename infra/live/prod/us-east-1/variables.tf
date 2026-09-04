variable "aws_account_id" {
  description = "Twelve-digit production AWS account ID used as a provider safety boundary."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be exactly 12 digits."
  }
}

variable "aws_region" {
  description = "Approved workload region. CloudFront viewer certificates also use us-east-1."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = var.aws_region == "us-east-1"
    error_message = "The initial architecture permits only us-east-1."
  }
}

variable "owner" {
  description = "Approved operational owner name or team; do not use a credential email address."
  type        = string

  validation {
    condition     = length(trimspace(var.owner)) >= 3
    error_message = "owner must name the accountable team or person."
  }
}

variable "cost_center" {
  description = "Approved billing allocation identifier."
  type        = string

  validation {
    condition     = length(trimspace(var.cost_center)) >= 2
    error_message = "cost_center must be supplied."
  }
}

variable "assume_role_arn" {
  description = "Optional OrganizationAccountAccessRole in the ALV account. Empty means credentials already belong to aws_account_id."
  type        = string
  default     = ""

  validation {
    condition     = var.assume_role_arn == "" || can(regex("^arn:aws:iam::[0-9]{12}:role/.+", var.assume_role_arn))
    error_message = "assume_role_arn must be empty or an IAM role ARN."
  }
}

variable "retreat_callback_urls" {
  description = "Cognito hosted UI callback URLs for the staff SPA. Includes GitHub Pages while that origin is the public test site."
  type        = list(string)
  default = [
    "http://127.0.0.1:4321/warrior-retreat-staff/",
    "http://localhost:4321/warrior-retreat-staff/",
    "https://patguettler.github.io/ALV/warrior-retreat-staff/",
    "https://alabamaveteran.org/warrior-retreat-staff/",
    "https://www.alabamaveteran.org/warrior-retreat-staff/",
  ]
}

variable "retreat_logout_urls" {
  description = "Cognito logout redirect URLs. Includes GitHub Pages while that origin is the public test site."
  type        = list(string)
  default = [
    "http://127.0.0.1:4321/warrior-retreat-staff/",
    "http://localhost:4321/warrior-retreat-staff/",
    "https://patguettler.github.io/ALV/warrior-retreat-staff/",
    "https://alabamaveteran.org/warrior-retreat-staff/",
    "https://www.alabamaveteran.org/warrior-retreat-staff/",
  ]
}

variable "retreat_allowed_origins" {
  description = "CORS origins allowed to call the retreat API. Includes GitHub Pages while that origin is the public test site."
  type        = list(string)
  default = [
    "http://127.0.0.1:4321",
    "http://localhost:4321",
    "https://patguettler.github.io",
    "https://alabamaveteran.org",
    "https://www.alabamaveteran.org",
  ]
}

variable "staff_invite_email" {
  description = "Invite-only Cognito username/email for the first staff operator."
  type        = string
  default     = "patguettler@gmail.com"
}

variable "super_admin_emails" {
  description = "Emails that can invite and revoke retreat staff. All other staff can only review applications."
  type        = list(string)
  default = [
    "patguettler@gmail.com",
    "c.montz@alabamaveteran.org",
  ]

  validation {
    condition = length(var.super_admin_emails) >= 1 && alltrue([
      for email in var.super_admin_emails : can(regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", email))
    ])
    error_message = "super_admin_emails must contain at least one valid email address."
  }
}

variable "data_classification" {
  description = "Highest data classification permitted in this environment root."
  type        = string
  default     = "restricted"

  validation {
    condition = contains(
      ["public", "internal", "confidential", "restricted"],
      var.data_classification,
    )
    error_message = "data_classification must be public, internal, confidential, or restricted."
  }
}
