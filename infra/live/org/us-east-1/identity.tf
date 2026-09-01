data "aws_ssoadmin_instances" "this" {}

locals {
  identity_center_enabled = length(data.aws_ssoadmin_instances.this.arns) == 1
  sso_instance_arn        = local.identity_center_enabled ? tolist(data.aws_ssoadmin_instances.this.arns)[0] : null
  identity_store_id       = local.identity_center_enabled ? tolist(data.aws_ssoadmin_instances.this.identity_store_ids)[0] : null
  alv_account_keys = toset([
    for key, account in var.accounts : key if account.product == "alv"
  ])
}

resource "aws_identitystore_group" "alv" {
  count = local.identity_center_enabled ? 1 : 0

  identity_store_id = local.identity_store_id
  display_name      = "alv-operators"
  description       = "AWS console access to the ALV tenant accounts only."
}

resource "aws_identitystore_user" "alv" {
  for_each = local.identity_center_enabled ? var.alv_operators : {}

  identity_store_id = local.identity_store_id
  display_name      = "${each.value.given_name} ${each.value.family_name}"
  user_name         = each.value.email

  name {
    given_name  = each.value.given_name
    family_name = each.value.family_name
  }

  emails {
    value   = each.value.email
    primary = true
    type    = "work"
  }
}

resource "aws_identitystore_group_membership" "alv" {
  for_each = local.identity_center_enabled ? var.alv_operators : {}

  identity_store_id = local.identity_store_id
  group_id          = aws_identitystore_group.alv[0].group_id
  member_id         = aws_identitystore_user.alv[each.key].user_id
}

resource "aws_ssoadmin_permission_set" "alv" {
  count = local.identity_center_enabled ? 1 : 0

  name             = "ALVAdministrator"
  description      = "Administrator access limited to ALV member accounts."
  instance_arn     = local.sso_instance_arn
  session_duration = "PT4H"
}

resource "aws_ssoadmin_managed_policy_attachment" "alv" {
  count = local.identity_center_enabled ? 1 : 0

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.alv[0].arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_ssoadmin_account_assignment" "alv" {
  for_each = local.identity_center_enabled ? local.alv_account_keys : toset([])

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.alv[0].arn
  principal_id       = aws_identitystore_group.alv[0].group_id
  principal_type     = "GROUP"
  target_id          = aws_organizations_account.this[each.key].id
  target_type        = "AWS_ACCOUNT"
}
