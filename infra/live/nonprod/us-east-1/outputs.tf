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
