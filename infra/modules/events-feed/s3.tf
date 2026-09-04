resource "aws_s3_bucket" "logs" {
  # checkov:skip=CKV_AWS_18:This bucket is the access-log destination; it cannot log to itself.
  # checkov:skip=CKV_AWS_144:Cross-region replication waits for the customer-approved RPO/RTO in #63.
  # checkov:skip=CKV_AWS_145:Access logs contain no event bodies; SSE-S3 matches the public-site origin.
  # checkov:skip=CKV2_AWS_62:Log objects have no approved event consumer.
  bucket = local.logs_bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  depends_on = [aws_s3_bucket_versioning.logs]

  rule {
    id     = "events-log-retention"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "logs_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.logs.arn,
      "${aws_s3_bucket.logs.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid       = "AllowS3AccessLogs"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.logs.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["logging.s3.amazonaws.com"]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.feed.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = data.aws_iam_policy_document.logs_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.logs]
}

resource "aws_s3_bucket" "feed" {
  # checkov:skip=CKV_AWS_144:Cross-region replication waits for the customer-approved RPO/RTO in #63.
  # checkov:skip=CKV_AWS_145:This origin stores a public JSON calendar feed; SSE-S3 matches the static-site origin.
  # checkov:skip=CKV2_AWS_62:Feed object events have no approved consumer; Lambda writes and CloudFront reads.
  bucket = local.feed_bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_ownership_controls" "feed" {
  bucket = aws_s3_bucket.feed.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "feed" {
  bucket = aws_s3_bucket.feed.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "feed" {
  bucket = aws_s3_bucket.feed.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "feed" {
  bucket = aws_s3_bucket.feed.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "feed" {
  bucket        = aws_s3_bucket.feed.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access/events-feed/"
}

resource "aws_s3_bucket_lifecycle_configuration" "feed" {
  bucket = aws_s3_bucket.feed.id

  depends_on = [aws_s3_bucket_versioning.feed]

  rule {
    id     = "events-feed-version-retention"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "feed_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.feed.arn,
      "${aws_s3_bucket.feed.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid       = "AllowCloudFrontReadFeed"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.feed.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.feed.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "feed" {
  bucket = aws_s3_bucket.feed.id
  policy = data.aws_iam_policy_document.feed_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.feed]
}

resource "aws_s3_object" "placeholder" {
  bucket                 = aws_s3_bucket.feed.id
  key                    = var.feed_object_key
  content                = "{\"version\":1,\"generatedAt\":\"1970-01-01T00:00:00.000Z\",\"events\":[]}\n"
  content_type           = "application/json; charset=utf-8"
  cache_control          = "public, max-age=15"
  server_side_encryption = "AES256"

  lifecycle {
    ignore_changes = [content, content_type, etag, cache_control, source]
  }

  depends_on = [aws_s3_bucket_policy.feed]
}
