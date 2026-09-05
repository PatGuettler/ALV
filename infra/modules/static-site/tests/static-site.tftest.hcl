mock_provider "aws" {}

variables {
  bucket_name                       = "alv-test-286801153738-web"
  aws_account_id                    = "286801153738"
  origin_access_control_name        = "alv-test-web-oac"
  access_log_bucket_name            = "alv-test-access-logs"
  cloudfront_log_bucket_domain_name = "alv-test-edge-logs.s3.amazonaws.com"
  deployment_role_arns              = ["arn:aws:iam::286801153738:role/alv-test-github-site-deploy"]
  web_acl_id                        = "arn:aws:wafv2:us-east-1:286801153738:global/webacl/alv-test/11111111-2222-3333-4444-555555555555"
  alarm_sns_topic_arn               = "arn:aws:sns:us-east-1:286801153738:alv-test-alarms"
  tags = {
    Project     = "alabama-veteran"
    Environment = "test"
    ManagedBy   = "terraform"
  }
}

run "private_origin_and_global_edge" {
  command = plan

  assert {
    condition = (
      aws_s3_bucket_public_access_block.origin.block_public_acls &&
      aws_s3_bucket_public_access_block.origin.block_public_policy &&
      aws_s3_bucket_public_access_block.origin.ignore_public_acls &&
      aws_s3_bucket_public_access_block.origin.restrict_public_buckets
    )
    error_message = "The web origin must block every form of public access."
  }

  assert {
    condition     = aws_s3_bucket_versioning.origin.versioning_configuration[0].status == "Enabled"
    error_message = "Origin versioning must stay enabled for rollback."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.price_class == "PriceClass_All"
    error_message = "The public site must use the global CloudFront edge network."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.web_acl_id == var.web_acl_id
    error_message = "The distribution must attach the CloudFront-scope WAF."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_root_object == "index.html"
    error_message = "The distribution must serve index.html as the default object."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Viewers must be redirected to HTTPS."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.site.ordered_cache_behavior) == 2
    error_message = "Fingerprinted asset prefixes must use dedicated long-cache behaviors."
  }

  assert {
    condition     = aws_cloudfront_cache_policy.html.default_ttl == 0
    error_message = "HTML must revalidate from origin by default."
  }

  assert {
    condition     = aws_cloudfront_cache_policy.immutable.default_ttl == 31536000
    error_message = "Fingerprinted assets must be cached for one year."
  }
}

run "reject_self_logging" {
  command = plan

  variables {
    access_log_bucket_name = "alv-test-286801153738-web"
  }

  expect_failures = [var.access_log_bucket_name]
}
