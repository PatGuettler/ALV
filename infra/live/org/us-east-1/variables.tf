variable "management_account_id" {
  description = "Twelve-digit existing keyTrain payer account. Clickops in this account stays unmanaged; this root only adds org, tenants, and Identity Center."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.management_account_id))
    error_message = "management_account_id must be exactly 12 digits."
  }
}

variable "never_manage_account_ids" {
  description = "Other AWS accounts that must not be invited or treated as product tenants. Do not list the KeyTrain payer."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for id in var.never_manage_account_ids : can(regex("^[0-9]{12}$", id))
    ])
    error_message = "never_manage_account_ids must contain only 12-digit account IDs."
  }
}

variable "aws_region" {
  description = "Home Region for organization APIs. Workload Regions stay us-east-1 for now."
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
  description = "Approved billing allocation identifier for the keyTrain organization."
  type        = string

  validation {
    condition     = length(trimspace(var.cost_center)) >= 2
    error_message = "cost_center must be supplied."
  }
}

variable "monthly_budget_usd" {
  description = "Organization-wide monthly cost budget in USD. This is an alarm, not a hard stop."
  type        = string
  default     = "100"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?$", var.monthly_budget_usd))
    error_message = "monthly_budget_usd must be a positive number."
  }
}

variable "budget_notification_email" {
  description = "Email that receives AWS Budget alerts. Not used as an account login."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_notification_email))
    error_message = "budget_notification_email must be a valid email address."
  }
}

variable "organizational_units" {
  description = "OUs under the organization root. Account.ou values must match these keys."
  type = map(object({
    display_name = string
  }))
  default = {
    security = {
      display_name = "security"
    }
    infrastructure = {
      display_name = "infrastructure"
    }
    halo = {
      display_name = "halo"
    }
    keytrainlearning = {
      display_name = "keytrainlearning"
    }
    websites = {
      display_name = "websites"
    }
  }
}

variable "accounts" {
  description = "Member accounts Terraform will create. Omit a key until its unique root email exists. Never add clickops account IDs here."
  type = map(object({
    name        = string
    email       = string
    ou          = string
    product     = string
    environment = string
  }))

  validation {
    condition = alltrue([
      for account in var.accounts : contains(
        ["security", "shared", "nonprod", "prod"],
        account.environment,
      )
    ])
    error_message = "account.environment must be security, shared, nonprod, or prod."
  }

  validation {
    condition = alltrue([
      for account in var.accounts : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", account.email))
    ])
    error_message = "Each account email must be a unique address that is not already an AWS account."
  }
}

variable "alv_operators" {
  description = "People who should see the ALV tenant in the Identity Center portal. Alabama Veteran staff use Cognito later, not this AWS login."
  type = map(object({
    email       = string
    given_name  = string
    family_name = string
  }))
  default = {}

  validation {
    condition = alltrue([
      for operator in var.alv_operators : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", operator.email))
    ])
    error_message = "Each ALV operator email must be a valid address."
  }
}
