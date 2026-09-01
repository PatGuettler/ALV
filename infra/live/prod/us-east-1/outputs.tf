output "environment_context" {
  description = "Non-sensitive naming and tag context consumed by future workload modules."
  value = {
    account_id      = var.aws_account_id
    region          = var.aws_region
    environment     = local.environment
    resource_prefix = local.resource_prefix
    tags            = local.required_tags
  }
}

output "retreat_api_url" {
  description = "Public HTTPS base URL for the Warrior Retreat API."
  value       = aws_apigatewayv2_api.retreat.api_endpoint
}

output "retreat_cognito_domain" {
  description = "Hosted UI origin for staff login. Not the Identity Center portal."
  value       = "https://${aws_cognito_user_pool_domain.staff.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "retreat_cognito_client_id" {
  description = "Public SPA app client ID. Safe to embed in the static site."
  value       = aws_cognito_user_pool_client.staff.id
}

output "retreat_staff_user_pool_id" {
  description = "Cognito user pool for invite-only Alabama Veteran staff."
  value       = aws_cognito_user_pool.staff.id
}
