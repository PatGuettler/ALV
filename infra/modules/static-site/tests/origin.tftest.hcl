mock_provider "aws" {}

override_resource {
  target = aws_s3_bucket.origin
  values = {
    id                           = "alv-test-web-origin"
    arn                          = "arn:aws:s3:::alv-test-web-origin"
    bucket_regional_domain_name  = "alv-test-web-origin.s3.us-east-1.amazonaws.com"
  }
}

variables {
  bucket_name                    = "alv-test-web-origin"
  access_log_bucket_name         = "alv-test-central-logs"
  deployment_role_arns           = ["arn:aws:iam::111111111111:role/alv-test-deploy"]
  aws_account_id                 = "111111111111"
  cloudfront_distribution_arn    = "arn:aws:cloudfront::111111111111:distribution/E1234567890ABC"
  origin_access_control_name     = "alv-test-origin"
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
}

run "reject_self_logging" {
  command = plan

  variables {
    access_log_bucket_name = "alv-test-web-origin"
  }

  expect_failures = [var.access_log_bucket_name]
}

run "reject_cross_account_distribution" {
  command = plan

  variables {
    cloudfront_distribution_arn = "arn:aws:cloudfront::222222222222:distribution/E1234567890ABC"
  }

  expect_failures = [check.distribution_belongs_to_account]
}
