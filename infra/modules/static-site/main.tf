terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.62.0"
    }
  }
}

resource "aws_s3_bucket" "origin" {
  # checkov:skip=CKV_AWS_144:Cross-region replication waits for the customer-approved RPO/RTO in #63; version recovery is enabled now.
  # checkov:skip=CKV_AWS_145:This origin stores public static assets only; SSE-S3 provides approved at-rest encryption without KMS policy/cost overhead.
  # checkov:skip=CKV2_AWS_62:Static-origin object events have no approved consumer; access logging and versioning provide the required audit/recovery controls.
  bucket = var.bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_ownership_controls" "origin" {
  bucket = aws_s3_bucket.origin.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "origin" {
  bucket = aws_s3_bucket.origin.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "origin" {
  bucket = aws_s3_bucket.origin.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "origin" {
  bucket = aws_s3_bucket.origin.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "origin" {
  bucket        = aws_s3_bucket.origin.id
  target_bucket = var.access_log_bucket_name
  target_prefix = var.access_log_prefix
}

resource "aws_s3_bucket_lifecycle_configuration" "origin" {
  bucket = aws_s3_bucket.origin.id

  depends_on = [aws_s3_bucket_versioning.origin]

  rule {
    id     = "version-retention"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_cloudfront_origin_access_control" "origin" {
  name                              = var.origin_access_control_name
  description                       = "Signed CloudFront access to ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

locals {
  cloudfront_origin_policy = {
    action         = "s3:GetObject"
    principal      = "cloudfront.amazonaws.com"
    source_account = var.aws_account_id
    source_arn     = aws_cloudfront_distribution.site.arn
  }
}

resource "aws_s3_bucket_policy" "origin" {
  bucket = aws_s3_bucket.origin.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.origin.arn, "${aws_s3_bucket.origin.arn}/*"]
        Principal = "*"
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid      = "AllowDeploymentBucketRead"
        Effect   = "Allow"
        Action   = ["s3:GetBucketLocation", "s3:ListBucket"]
        Resource = aws_s3_bucket.origin.arn
        Principal = {
          AWS = var.deployment_role_arns
        }
      },
      {
        Sid    = "AllowDeploymentObjectChanges"
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:PutObject",
        ]
        Resource = "${aws_s3_bucket.origin.arn}/*"
        Principal = {
          AWS = var.deployment_role_arns
        }
      },
      {
        Sid      = "AllowCloudFrontReadFromApprovedDistribution"
        Effect   = "Allow"
        Action   = local.cloudfront_origin_policy.action
        Resource = "${aws_s3_bucket.origin.arn}/*"
        Principal = {
          Service = local.cloudfront_origin_policy.principal
        }
        Condition = {
          ArnEquals = {
            "AWS:SourceArn" = local.cloudfront_origin_policy.source_arn
          }
          StringEquals = {
            "AWS:SourceAccount" = local.cloudfront_origin_policy.source_account
          }
        }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.origin]
}
