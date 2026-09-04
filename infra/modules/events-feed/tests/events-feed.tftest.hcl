mock_provider "aws" {}

override_data {
  target          = data.aws_iam_policy_document.logs_bucket
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [
        { Sid = "DenyInsecureTransport", Effect = "Deny" },
        { Sid = "AllowS3AccessLogs", Effect = "Allow" },
      ]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.feed_bucket
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [
        { Sid = "DenyInsecureTransport", Effect = "Deny" },
        { Sid = "AllowCloudFrontReadFeed", Effect = "Allow", Principal = { Service = "cloudfront.amazonaws.com" } },
      ]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.lambda_assume
  override_during = plan
  values = {
    json = jsonencode({
      Version   = "2012-10-17"
      Statement = [{ Sid = "LambdaAssume", Effect = "Allow" }]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.lambda
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [
        { Sid = "WriteEventsSyncLogs", Effect = "Allow" },
        { Sid = "ReadWriteEventsFeedObject", Effect = "Allow" },
        { Sid = "ReadGhlToken", Effect = "Allow" },
        { Sid = "SendFailedSyncToDlq", Effect = "Allow" },
      ]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.dlq
  override_during = plan
  values = {
    json = jsonencode({
      Version   = "2012-10-17"
      Statement = [{ Sid = "AllowSchedulerFailures", Effect = "Allow" }]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.scheduler_assume
  override_during = plan
  values = {
    json = jsonencode({
      Version   = "2012-10-17"
      Statement = [{ Sid = "SchedulerAssume", Effect = "Allow" }]
    })
  }
}

override_data {
  target          = data.aws_iam_policy_document.scheduler
  override_during = plan
  values = {
    json = jsonencode({
      Version = "2012-10-17"
      Statement = [
        { Sid = "InvokeEventsSync", Effect = "Allow" },
        { Sid = "SendSchedulerFailures", Effect = "Allow" },
      ]
    })
  }
}

variables {
  name                   = "alv-nonprod"
  aws_account_id         = "111111111111"
  ghl_location_id        = "jpHzkfKyYJW7cGNPHePS"
  ghl_events_calendar_id = "zfYlU1tekAs9O3E2xGT8"
  allowed_origins = [
    "https://patguettler.github.io",
    "http://127.0.0.1:4321",
  ]
  tags = {
    Project     = "alabama-veteran"
    Environment = "nonprod"
    ManagedBy   = "terraform"
  }
}

run "public_feed_stays_private_and_refreshes_every_minute" {
  command = plan

  assert {
    condition = (
      aws_s3_bucket_public_access_block.feed.block_public_acls &&
      aws_s3_bucket_public_access_block.feed.block_public_policy &&
      aws_s3_bucket_public_access_block.feed.ignore_public_acls &&
      aws_s3_bucket_public_access_block.feed.restrict_public_buckets
    )
    error_message = "The events origin bucket must block every form of public access."
  }

  assert {
    condition     = aws_cloudfront_distribution.feed.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "The events feed must be HTTPS-only."
  }

  assert {
    condition     = aws_scheduler_schedule.events_sync.schedule_expression == "rate(1 minute)"
    error_message = "The GHL sync schedule must run every minute, the EventBridge Scheduler minimum."
  }

  assert {
    condition = (
      contains(keys(aws_lambda_function.events_sync.environment[0].variables), "GHL_TOKEN_SECRET_ARN") &&
      !contains(keys(aws_lambda_function.events_sync.environment[0].variables), "GHL_PRIVATE_INTEGRATION_TOKEN")
    )
    error_message = "The GHL token must stay in Secrets Manager, not Lambda environment variables."
  }

  assert {
    condition     = aws_cloudfront_distribution.feed.viewer_certificate[0].cloudfront_default_certificate
    error_message = "Staging uses the CloudFront default certificate until a custom staging hostname exists."
  }
}
