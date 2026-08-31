mock_provider "aws" {}

variables {
  bucket_name            = "avl-test-web-origin"
  access_log_bucket_name = "avl-test-central-logs"
  deployment_role_arns   = ["arn:aws:iam::111111111111:role/avl-test-deploy"]
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
}

run "reject_self_logging" {
  command = plan

  variables {
    access_log_bucket_name = "avl-test-web-origin"
  }

  expect_failures = [var.access_log_bucket_name]
}
