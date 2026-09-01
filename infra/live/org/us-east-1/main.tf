locals {
  company_name    = "keytrain"
  resource_prefix = "keytrain-org"
  required_tags = {
    Company            = local.company_name
    Project            = "organization"
    Environment        = "management"
    ManagedBy          = "terraform"
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = "internal"
  }
}

data "aws_caller_identity" "current" {}

check "runs_only_in_management_account" {
  assert {
    condition     = data.aws_caller_identity.current.account_id == var.management_account_id
    error_message = "Org Terraform must use credentials for the existing keyTrain payer account."
  }
}

check "payer_is_not_listed_as_foreign" {
  assert {
    condition     = !contains(var.never_manage_account_ids, var.management_account_id)
    error_message = "never_manage_account_ids is for other leftover accounts, not the keyTrain payer."
  }
}

resource "aws_organizations_organization" "keytrain" {
  feature_set = "ALL"

  enabled_policy_types = [
    "SERVICE_CONTROL_POLICY",
  ]

  aws_service_access_principals = [
    "account.amazonaws.com",
    "cloudtrail.amazonaws.com",
    "config.amazonaws.com",
    "guardduty.amazonaws.com",
    "member.org.stacksets.cloudformation.amazonaws.com",
    "securityhub.amazonaws.com",
    "sso.amazonaws.com",
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_organizations_organizational_unit" "this" {
  for_each = var.organizational_units

  name      = each.value.display_name
  parent_id = aws_organizations_organization.keytrain.roots[0].id

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_organizations_account" "this" {
  for_each = var.accounts

  name                       = each.value.name
  email                      = each.value.email
  parent_id                  = aws_organizations_organizational_unit.this[each.value.ou].id
  iam_user_access_to_billing = "ALLOW"
  role_name                  = "OrganizationAccountAccessRole"
  close_on_deletion          = false

  tags = {
    Product     = each.value.product
    Environment = each.value.environment
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [role_name]
    precondition {
      condition     = contains(keys(var.organizational_units), each.value.ou)
      error_message = "Account ${each.key} references an OU that is not defined."
    }
  }
}

resource "aws_budgets_budget" "organization" {
  name              = "${local.resource_prefix}-monthly"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_usd
  limit_unit        = "USD"
  time_period_start = "2026-09-01_00:00"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_notification_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }
}
