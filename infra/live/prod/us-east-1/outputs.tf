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

output "retreat_data_kms_key_arn" {
  description = "Customer-managed KMS key protecting retreat application and audit tables."
  value       = aws_kms_key.retreat.arn
}

output "retreat_application_audit_table_name" {
  description = "Append-only staff application decision audit table."
  value       = aws_dynamodb_table.application_audit.name
}

output "site_origin_bucket" {
  description = "Private S3 origin for the production Astro release. Set GitHub AWS_PRODUCTION_BUCKET to this value."
  value       = module.static_site.origin_bucket.id
}

output "site_distribution_id" {
  description = "CloudFront distribution ID. Set GitHub AWS_PRODUCTION_DISTRIBUTION_ID to this value."
  value       = module.static_site.distribution.id
}

output "site_url" {
  description = "HTTPS origin for the CloudFront distribution until the custom domain is attached."
  value       = module.static_site.distribution.url
}

output "github_site_deploy_role_arn" {
  description = "OIDC role assumed by the production-deploy GitHub Environment. Set AWS_PRODUCTION_DEPLOY_ROLE_ARN to this value."
  value       = aws_iam_role.github_site_deploy.arn
}
