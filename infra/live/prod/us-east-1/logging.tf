resource "aws_s3_bucket" "access_logs" {
  # checkov:skip=CKV_AWS_144:Cross-region replication waits for the approved RPO/RTO in #63.
  # checkov:skip=CKV_AWS_145:Central access logs use SSE-S3 for CloudFront/S3 log-delivery compatibility.
  # checkov:skip=CKV2_AWS_61:This bucket is the logging destination; lifecycle is defined below.
  # checkov:skip=CKV2_AWS_62:Log objects have no approved event consumer; CloudWatch alarms cover public traffic.
  # checkov:skip=CKV_AWS_18:This bucket is the S3 access-log destination and cannot log to itself.
  bucket = "${local.resource_prefix}-${var.aws_account_id}-access-logs"
}

resource "aws_s3_bucket_ownership_controls" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  depends_on = [aws_s3_bucket_versioning.access_logs]

  rule {
    id     = "access-log-retention"
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

resource "aws_s3_bucket_policy" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.access_logs.arn, "${aws_s3_bucket.access_logs.arn}/*"]
        Principal = "*"
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid      = "AllowS3ServerAccessLogs"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.access_logs.arn}/*"
        Principal = {
          Service = "logging.s3.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = var.aws_account_id
          }
          ArnLike = {
            "aws:SourceArn" = [
              "arn:aws:s3:::${local.site_bucket_name}",
              "arn:aws:s3:::${local.edge_log_bucket_name}",
            ]
          }
        }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.access_logs]
}
