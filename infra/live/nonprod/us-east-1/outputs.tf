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

output "events_feed_url" {
  description = "Public HTTPS URL the GitHub Pages staging calendar polls for GHL updates."
  value       = module.events_feed.feed_url
}

output "events_feed_secret_name" {
  description = "Secrets Manager name for the GoHighLevel private integration token. Set the value after apply."
  value       = module.events_feed.ghl_token_secret_name
}
