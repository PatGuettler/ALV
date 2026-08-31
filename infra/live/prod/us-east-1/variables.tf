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
