output "web_acl" {
  description = "CloudFront-scope WAF identifiers consumed by the static-site distribution."
  value = {
    id   = aws_wafv2_web_acl.edge.id
    arn  = aws_wafv2_web_acl.edge.arn
    name = aws_wafv2_web_acl.edge.name
  }
}

output "edge_logs" {
  description = "Edge log destinations consumed by CloudFront and operations."
  value = {
    cloudfront_bucket_arn         = aws_s3_bucket.edge_logs.arn
    cloudfront_bucket_domain_name = aws_s3_bucket.edge_logs.bucket_domain_name
    waf_log_group_arn             = aws_cloudwatch_log_group.waf.arn
    waf_log_kms_key_arn           = aws_kms_key.waf_logs.arn
  }
}
