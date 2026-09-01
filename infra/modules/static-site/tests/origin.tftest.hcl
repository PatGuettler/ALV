mock_provider "aws" {}

override_resource {
  target = aws_s3_bucket.origin
  values = {
    id                          = "alv-test-web-origin"
    arn                         = "arn:aws:s3:::alv-test-web-origin"
    bucket_regional_domain_name = "alv-test-web-origin.s3.us-east-1.amazonaws.com"
  }
}

override_resource {
  target          = aws_cloudfront_distribution.site
  override_during = plan
  values = {
    arn = "arn:aws:cloudfront::111111111111:distribution/E1234567890ABC"
  }
}

variables {
  bucket_name                       = "alv-test-web-origin"
  access_log_bucket_name            = "alv-test-central-logs"
  deployment_role_arns              = ["arn:aws:iam::111111111111:role/alv-test-deploy"]
  aws_account_id                    = "111111111111"
  distribution_name                 = "alv-test"
  origin_access_control_name        = "alv-test-origin"
  domain_aliases                    = ["www.example.com"]
  acm_certificate_arn               = "arn:aws:acm:us-east-1:111111111111:certificate/12345678-1234-1234-1234-123456789abc"
  web_acl_arn                       = "arn:aws:wafv2:us-east-1:111111111111:global/webacl/alv-test/12345678-1234-1234-1234-123456789abc"
  cloudfront_log_bucket_domain_name = "alv-test-edge-logs.s3.amazonaws.com"
  content_security_policy           = "default-src 'self'; object-src 'none'; frame-ancestors 'self'"
  tags = {
    Project     = "alabama-veteran"
    Environment = "test"
    ManagedBy   = "terraform"
  }
}

run "secure_origin_defaults" {
  command = plan

  assert {
    condition     = aws_s3_bucket_public_access_block.origin.block_public_acls
    error_message = "Public ACLs must be blocked."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.origin.block_public_policy
    error_message = "Public bucket policies must be blocked."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.origin.ignore_public_acls
    error_message = "Existing public ACLs must be ignored."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.origin.restrict_public_buckets
    error_message = "Public buckets must be restricted."
  }

  assert {
    condition = (
      one(aws_s3_bucket_versioning.origin.versioning_configuration).status == "Enabled"
    )
    error_message = "Object versioning must be enabled."
  }

  assert {
    condition = (
      one(one(aws_s3_bucket_server_side_encryption_configuration.origin.rule)
      .apply_server_side_encryption_by_default).sse_algorithm == "AES256"
    )
    error_message = "Default server-side encryption must be enabled."
  }

  assert {
    condition = (
      one(aws_s3_bucket_ownership_controls.origin.rule).object_ownership == "BucketOwnerEnforced"
    )
    error_message = "ACLs must be disabled with bucket-owner enforcement."
  }

  assert {
    condition     = one(aws_s3_bucket_lifecycle_configuration.origin.rule).status == "Enabled"
    error_message = "The rollback lifecycle rule must be enabled."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.origin.signing_behavior == "always"
    error_message = "CloudFront must sign every S3 origin request."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.origin.signing_protocol == "sigv4"
    error_message = "CloudFront must use SigV4 for the S3 origin."
  }

  assert {
    condition = (
      local.cloudfront_origin_policy.source_arn ==
      "arn:aws:cloudfront::111111111111:distribution/E1234567890ABC"
    )
    error_message = "The bucket policy must scope CloudFront access to the approved distribution."
  }

  assert {
    condition = (
      local.cloudfront_origin_policy.principal == "cloudfront.amazonaws.com" &&
      local.cloudfront_origin_policy.action == "s3:GetObject" &&
      local.cloudfront_origin_policy.source_account == "111111111111"
    )
    error_message = "CloudFront access must use the service principal and read-only account scope."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_root_object == "index.html"
    error_message = "CloudFront must resolve the root document without S3 website hosting."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.http_version == "http2and3"
    error_message = "CloudFront must enable HTTP/2 and HTTP/3."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.site.default_cache_behavior).compress
    error_message = "CloudFront must compress eligible site responses."
  }

  assert {
    condition = (
      one(aws_cloudfront_distribution.site.default_cache_behavior).viewer_protocol_policy ==
      "redirect-to-https"
    )
    error_message = "CloudFront must redirect HTTP requests to HTTPS."
  }

  assert {
    condition = (
      one(aws_cloudfront_distribution.site.viewer_certificate).minimum_protocol_version ==
      "TLSv1.2_2021"
    )
    error_message = "CloudFront must reject legacy TLS versions."
  }

  assert {
    condition = (
      aws_cloudfront_cache_policy.html.max_ttl == 300 &&
      aws_cloudfront_cache_policy.immutable.min_ttl == 31536000
    )
    error_message = "HTML must remain short-lived while fingerprinted assets remain immutable."
  }

  assert {
    condition = strcontains(
      aws_cloudfront_function.directory_rewrite.code,
      "request.uri = uri + '/index.html'",
    )
    error_message = "The viewer-request function must resolve extensionless directory routes."
  }
}

run "reject_self_logging" {
  command = plan

  variables {
    access_log_bucket_name = "alv-test-web-origin"
  }

  expect_failures = [var.access_log_bucket_name]
}

run "reject_cross_account_certificate" {
  command = plan

  variables {
    acm_certificate_arn = "arn:aws:acm:us-east-1:222222222222:certificate/12345678-1234-1234-1234-123456789abc"
  }

  expect_failures = [check.certificate_belongs_to_account]
}
