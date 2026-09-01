output "organization" {
  description = "Non-sensitive organization identifiers for product Terraform roots."
  value = {
    id                    = aws_organizations_organization.keytrain.id
    arn                   = aws_organizations_organization.keytrain.arn
    management_account_id = var.management_account_id
    root_id               = aws_organizations_organization.keytrain.roots[0].id
  }
}

output "organizational_units" {
  description = "OU IDs keyed by the Terraform map key."
  value = {
    for key, unit in aws_organizations_organizational_unit.this : key => {
      id   = unit.id
      name = unit.name
    }
  }
}

output "accounts" {
  description = "Created member account IDs. Does not include the keyTrain payer/clickops account."
  value = {
    for key, account in aws_organizations_account.this : key => {
      id          = account.id
      name        = account.name
      product     = var.accounts[key].product
      environment = var.accounts[key].environment
      ou          = var.accounts[key].ou
    }
  }
}

output "alv_tenant" {
  description = "Identity Center group and ALV account IDs for the ALV login tile."
  value = {
    identity_center_enabled = local.identity_center_enabled
    group_id                = try(aws_identitystore_group.alv[0].group_id, null)
    permission_set_arn      = try(aws_ssoadmin_permission_set.alv[0].arn, null)
    account_ids = {
      for key in local.alv_account_keys : key => aws_organizations_account.this[key].id
    }
  }
}
