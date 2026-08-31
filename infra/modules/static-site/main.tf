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

data "aws_iam_policy_document" "origin" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"
    actions = [
      "s3:*",
    ]
    resources = [
      aws_s3_bucket.origin.arn,
      "${aws_s3_bucket.origin.arn}/*",
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
    sid    = "AllowDeploymentBucketRead"
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [aws_s3_bucket.origin.arn]

    principals {
      type        = "AWS"
      identifiers = var.deployment_role_arns
    }
  }

  statement {
    sid    = "AllowDeploymentObjectChanges"
    effect = "Allow"
    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.origin.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = var.deployment_role_arns
    }
  }
}

resource "aws_s3_bucket_policy" "origin" {
  bucket = aws_s3_bucket.origin.id
  policy = data.aws_iam_policy_document.origin.json

  depends_on = [aws_s3_bucket_public_access_block.origin]
}

# CloudFront OAC access is added to this single bucket policy by #81.
