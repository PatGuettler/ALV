mock_provider "aws" {}

override_data {
  target          = data.aws_iam_policy_document.originals_key
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Sid    = "AllowAccountKeyAdministration"
        Effect = "Allow"
      }]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.originals_bucket
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [
        { Sid = "DenyInsecureTransport", Effect = "Deny" },
        { Sid = "DenyPublicPrincipals", Effect = "Deny" },
        { Sid = "AllowUploaderPrivatePuts", Effect = "Allow" },
      ]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.derivatives_bucket
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [
        { Sid = "DenyInsecureTransport", Effect = "Deny" },
        { Sid = "AllowCloudFrontReadDerivatives", Effect = "Allow", Principal = { Service = "cloudfront.amazonaws.com" } },
      ]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.uploader
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Sid    = "PutPrivateOriginalsOnly"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:AbortMultipartUpload"]
      }]
    })
  }
}

variables {
  name                   = "alv-prod-media"
  aws_account_id         = "111111111111"
  access_log_bucket_name = "alv-prod-logs"
  uploader_role_arn      = "arn:aws:iam::111111111111:role/alv-prod-media-uploader"
  alarm_sns_topic_arn    = "arn:aws:sns:us-east-1:111111111111:alv-prod-alarms"
  tags = {
    Project     = "alabama-veteran"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

run "originals_cannot_be_made_public" {
  command = apply

  assert {
    condition = (
      aws_s3_bucket_public_access_block.originals.block_public_acls &&
      aws_s3_bucket_public_access_block.originals.block_public_policy &&
      aws_s3_bucket_public_access_block.originals.ignore_public_acls &&
      aws_s3_bucket_public_access_block.originals.restrict_public_buckets
    )
    error_message = "Originals must block every public-access setting."
  }

  assert {
    condition     = aws_s3_bucket_ownership_controls.originals.rule[0].object_ownership == "BucketOwnerEnforced"
    error_message = "BucketOwnerEnforced prevents object ACLs on originals."
  }

  assert {
    condition     = strcontains(data.aws_iam_policy_document.originals_bucket.json, "DenyPublicPrincipals")
    error_message = "Originals bucket policy must deny anonymous principals."
  }

  assert {
    condition = (
      !strcontains(data.aws_iam_policy_document.uploader.json, "s3:PutBucketAcl") &&
      !strcontains(data.aws_iam_policy_document.uploader.json, "s3:PutObjectAcl") &&
      !strcontains(data.aws_iam_policy_document.uploader.json, "s3:PutBucketPolicy")
    )
    error_message = "The uploader must not be able to attach a public ACL or bucket policy."
  }

  assert {
    condition     = aws_kms_key.originals.enable_key_rotation
    error_message = "Originals must use a rotating KMS key."
  }

  assert {
    condition = length([
      for rule in aws_s3_bucket_server_side_encryption_configuration.originals.rule : rule
      if one(rule.apply_server_side_encryption_by_default).sse_algorithm == "aws:kms"
    ]) == 1
    error_message = "Original objects must be KMS-encrypted."
  }

  assert {
    condition     = aws_s3_bucket_versioning.originals.versioning_configuration[0].status == "Enabled"
    error_message = "Originals must keep version history."
  }

  assert {
    condition     = aws_s3_bucket_logging.originals.target_bucket == var.access_log_bucket_name
    error_message = "Originals must write access logs to the dedicated log bucket."
  }
}

run "derivatives_are_cloudfront_only" {
  command = apply

  assert {
    condition = (
      aws_s3_bucket_public_access_block.derivatives.block_public_acls &&
      aws_s3_bucket_public_access_block.derivatives.restrict_public_buckets
    )
    error_message = "Derivative objects must not be anonymously readable from S3."
  }

  assert {
    condition     = aws_cloudfront_distribution.derivatives.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Derivative CloudFront access must force HTTPS."
  }

  assert {
    condition     = strcontains(data.aws_iam_policy_document.derivatives_bucket.json, "cloudfront.amazonaws.com")
    error_message = "Derivatives may be read only by the approved CloudFront distribution."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.derivative_5xx.metric_name == "5xxErrorRate"
    error_message = "Public derivative 5xx failures must alarm."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.derivative_4xx.metric_name == "4xxErrorRate"
    error_message = "Public derivative 4xx failures must alarm."
  }
}
