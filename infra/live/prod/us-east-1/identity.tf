resource "aws_cognito_user_pool" "staff" {
  # checkov:skip=CKV_AWS_345:Cognito Plus threat protection is deferred until the classified-field review; this pool is invite-only with required MFA.
  name = "${local.resource_prefix}-retreat-staff"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  deletion_protection      = "ACTIVE"
  mfa_configuration        = "ON"

  admin_create_user_config {
    allow_admin_create_user_only = true

    invite_message_template {
      email_subject = "Alabama Veteran staff portal invite"
      email_message = "You were invited to the Warrior Retreat staff portal. Username: {username}. Temporary password: {####}. Sign in at https://patguettler.github.io/ALV/warrior-retreat-staff/ On first login you must set a new password and enroll authenticator MFA before you can continue."
      sms_message   = "ALV staff invite. Username: {username} Temporary password: {####}"
    }
  }

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_domain" "staff" {
  domain       = "${local.resource_prefix}-retreat-${var.aws_account_id}"
  user_pool_id = aws_cognito_user_pool.staff.id
}

resource "aws_cognito_user_pool_client" "staff" {
  name         = "${local.resource_prefix}-retreat-spa"
  user_pool_id = aws_cognito_user_pool.staff.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = var.retreat_callback_urls
  logout_urls                          = var.retreat_logout_urls
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 7
}

resource "aws_cognito_user_group" "super_admin" {
  name         = "super-admin"
  user_pool_id = aws_cognito_user_pool.staff.id
  description  = "Invite and revoke retreat staff"
}

resource "aws_cognito_user_group" "reviewer" {
  name         = "reviewer"
  user_pool_id = aws_cognito_user_pool.staff.id
  description  = "Review retreat applications"
}

resource "aws_cognito_user" "staff" {
  user_pool_id             = aws_cognito_user_pool.staff.id
  username                 = var.staff_invite_email
  desired_delivery_mediums = ["EMAIL"]
  attributes = {
    email          = var.staff_invite_email
    email_verified = "true"
  }

  lifecycle {
    ignore_changes = [attributes]
  }
}

resource "aws_cognito_user" "super_admin" {
  for_each = toset([
    for email in var.super_admin_emails : lower(email) if lower(email) != lower(var.staff_invite_email)
  ])

  user_pool_id             = aws_cognito_user_pool.staff.id
  username                 = each.value
  desired_delivery_mediums = ["EMAIL"]
  attributes = {
    email          = each.value
    email_verified = "true"
  }

  lifecycle {
    ignore_changes = [attributes]
  }
}

resource "aws_cognito_user_in_group" "staff_super_admin" {
  user_pool_id = aws_cognito_user_pool.staff.id
  group_name   = aws_cognito_user_group.super_admin.name
  username     = aws_cognito_user.staff.username
}

resource "aws_cognito_user_in_group" "super_admin" {
  for_each     = aws_cognito_user.super_admin
  user_pool_id = aws_cognito_user_pool.staff.id
  group_name   = aws_cognito_user_group.super_admin.name
  username     = each.value.username
}
