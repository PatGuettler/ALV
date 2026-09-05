module "edge_security" {
  source = "../../../modules/edge-security"

  name                   = local.resource_prefix
  aws_account_id         = var.aws_account_id
  edge_log_bucket_name   = local.edge_log_bucket_name
  access_log_bucket_name = aws_s3_bucket.access_logs.id
  access_log_prefix      = "s3-access/edge-logs/"
  rate_limit_requests    = var.edge_rate_limit_requests
  tags                   = local.required_tags
}

module "static_site" {
  source = "../../../modules/static-site"

  bucket_name                       = local.site_bucket_name
  aws_account_id                    = var.aws_account_id
  origin_access_control_name        = "${local.resource_prefix}-web-oac"
  access_log_bucket_name            = aws_s3_bucket.access_logs.id
  access_log_prefix                 = "s3-access/web-origin/"
  cloudfront_log_bucket_domain_name = module.edge_security.edge_logs.cloudfront_bucket_domain_name
  cloudfront_log_prefix             = "cloudfront/web/"
  deployment_role_arns              = [aws_iam_role.github_site_deploy.arn]
  web_acl_id                        = module.edge_security.web_acl.arn
  alarm_sns_topic_arn               = aws_sns_topic.alarms.arn
  price_class                       = "PriceClass_All"
  tags                              = local.required_tags
}
