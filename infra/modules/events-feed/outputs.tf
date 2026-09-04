output "feed_url" {
  description = "Public HTTPS URL the staging site polls for calendar updates."
  value       = "https://${aws_cloudfront_distribution.feed.domain_name}/${var.feed_object_key}"
}

output "distribution_domain_name" {
  description = "CloudFront domain serving the public events JSON feed."
  value       = aws_cloudfront_distribution.feed.domain_name
}

output "feed_bucket_name" {
  description = "Private origin bucket that stores the public events JSON object."
  value       = aws_s3_bucket.feed.id
}

output "function_name" {
  description = "Lambda that pulls the AV Events Calendar and writes the public feed."
  value       = aws_lambda_function.events_sync.function_name
}

output "ghl_token_secret_arn" {
  description = "Secrets Manager ARN for the GoHighLevel private integration token. Set the value after apply."
  value       = aws_secretsmanager_secret.ghl_token.arn
}

output "ghl_token_secret_name" {
  description = "Secrets Manager name used to put the GoHighLevel token after apply."
  value       = aws_secretsmanager_secret.ghl_token.name
}
