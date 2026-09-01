mock_provider "aws" {}

override_data {
  target          = data.aws_iam_policy_document.waf_log_key
  override_during = plan
  values = {
    json = jsonencode({
      Version   = "2012-10-17"
      Statement = []
    })
  }
}

variables {
  name                   = "alv-test-edge"
  aws_account_id         = "111111111111"
  edge_log_bucket_name   = "alv-test-edge-logs"
  access_log_bucket_name = "alv-test-central-logs"
  tags = {
    Project     = "alabama-veteran"
    Environment = "test"
    ManagedBy   = "terraform"
  }
}

run "managed_protection_and_log_defaults" {
  command = plan

  assert {
    condition     = aws_wafv2_web_acl.edge.scope == "CLOUDFRONT"
    error_message = "The edge web ACL must use CloudFront scope."
  }

  assert {
    condition     = length(aws_wafv2_web_acl.edge.rule) == 4
    error_message = "The web ACL must include three managed groups and one rate rule."
  }

  assert {
    condition = (
      one([
        for rule in aws_wafv2_web_acl.edge.rule : rule
        if rule.name == "IpRateLimit"
      ]).statement[0].rate_based_statement[0].limit == 2000
    )
    error_message = "The tested edge rate rule must enforce the approved default threshold."
  }

  assert {
    condition     = aws_kms_key.waf_logs.enable_key_rotation
    error_message = "The WAF log key must rotate automatically."
  }

  assert {
    condition     = aws_cloudwatch_log_group.waf.retention_in_days == 365
    error_message = "WAF logs must retain the approved default history."
  }

  assert {
    condition     = length(aws_wafv2_web_acl_logging_configuration.edge.redacted_fields) == 2
    error_message = "Authorization and cookie headers must be redacted from WAF logs."
  }

  assert {
    condition = (
      aws_s3_bucket_public_access_block.edge_logs.block_public_acls &&
      aws_s3_bucket_public_access_block.edge_logs.block_public_policy &&
      aws_s3_bucket_public_access_block.edge_logs.ignore_public_acls &&
      aws_s3_bucket_public_access_block.edge_logs.restrict_public_buckets
    )
    error_message = "The edge log bucket must block every form of public access."
  }

  assert {
    condition = (
      one(aws_s3_bucket_lifecycle_configuration.edge_logs.rule).expiration[0].days == 90
    )
    error_message = "CloudFront logs must expire at the approved default retention."
  }
}

run "reject_self_logging" {
  command = plan

  variables {
    access_log_bucket_name = "alv-test-edge-logs"
  }

  expect_failures = [var.access_log_bucket_name]
}
