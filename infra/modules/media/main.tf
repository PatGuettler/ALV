terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.62.0"
    }
  }
}

check "log_bucket_is_separate" {
  assert {
    condition = (
      var.access_log_bucket_name != "${var.name}-originals" &&
      var.access_log_bucket_name != "${var.name}-derivatives"
    )
    error_message = "Media buckets cannot write access logs to themselves."
  }
}

resource "aws_kms_key" "originals" {
  description             = "Encrypt ${var.name} private media originals"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.originals_key.json
  tags                    = var.tags
}

resource "aws_kms_alias" "originals" {
  name          = "alias/${var.name}-media-originals"
  target_key_id = aws_kms_key.originals.key_id
}

data "aws_iam_policy_document" "originals_key" {
  # checkov:skip=CKV_AWS_356:KMS key-policy Resource "*" applies only to this key.
  # checkov:skip=CKV_AWS_111:S3 is constrained by ViaService and encryption context.
  # checkov:skip=CKV_AWS_109:Account-root administration prevents an unrecoverable key.
  statement {
    sid       = "AllowAccountKeyAdministration"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:root"]
    }
  }

  statement {
    sid    = "AllowS3ToEncryptOriginals"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey",
    ]
    resources = ["*"]

    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.us-east-1.amazonaws.com"]
    }
  }

  statement {
    sid    = "AllowUploaderToEncryptOriginals"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey",
    ]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = [var.uploader_role_arn]
    }
  }
}

resource "aws_s3_bucket" "originals" {
  # checkov:skip=CKV_AWS_144:Cross-region replication waits for the approved RPO/RTO.
  # checkov:skip=CKV2_AWS_62:Original object events have no approved consumer; access logs and versioning provide audit/recovery.
  bucket = "${var.name}-originals"
  tags   = var.tags
}

resource "aws_s3_bucket" "derivatives" {
  # checkov:skip=CKV_AWS_144:Cross-region replication waits for the approved RPO/RTO.
  # checkov:skip=CKV_AWS_145:Public derivatives use SSE-S3; originals remain KMS-encrypted.
  # checkov:skip=CKV2_AWS_62:Derivative object events have no approved consumer; CloudFront 5xx/4xx alarms cover public read failures.
  bucket = "${var.name}-derivatives"
  tags   = var.tags
}

resource "aws_s3_bucket_ownership_controls" "originals" {
  bucket = aws_s3_bucket.originals.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_ownership_controls" "derivatives" {
  bucket = aws_s3_bucket.derivatives.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "originals" {
  bucket = aws_s3_bucket.originals.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "derivatives" {
  bucket = aws_s3_bucket.derivatives.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "originals" {
  bucket = aws_s3_bucket.originals.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.originals.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "derivatives" {
  bucket = aws_s3_bucket.derivatives.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "originals" {
  bucket = aws_s3_bucket.originals.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "derivatives" {
  bucket = aws_s3_bucket.derivatives.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "originals" {
  bucket        = aws_s3_bucket.originals.id
  target_bucket = var.access_log_bucket_name
  target_prefix = "s3-access/${var.name}-originals/"
}

resource "aws_s3_bucket_logging" "derivatives" {
  bucket        = aws_s3_bucket.derivatives.id
  target_bucket = var.access_log_bucket_name
  target_prefix = "s3-access/${var.name}-derivatives/"
}

resource "aws_s3_bucket_lifecycle_configuration" "originals" {
  bucket = aws_s3_bucket.originals.id

  depends_on = [aws_s3_bucket_versioning.originals]

  rule {
    id     = "original-version-retention"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "derivatives" {
  bucket = aws_s3_bucket.derivatives.id

  depends_on = [aws_s3_bucket_versioning.derivatives]

  rule {
    id     = "derivative-version-retention"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_cloudfront_origin_access_control" "derivatives" {
  name                              = "${var.name}-media-derivatives"
  description                       = "Signed CloudFront access to ${var.name} derivatives"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "derivatives" {
  name        = "${var.name}-media-derivatives"
  comment     = "Long-lived cache for optimized public media derivatives"
  default_ttl = 86400
  min_ttl     = 0
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "derivatives" {
  name    = "${var.name}-media-security"
  comment = "Browser security headers for public media derivatives"

  security_headers_config {
    content_type_options {
      override = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }
}

resource "aws_cloudfront_distribution" "derivatives" {
  # checkov:skip=CKV_AWS_68:WAF attachment is owned by the edge-security module at the live root.
  # checkov:skip=CKV2_AWS_47:Same WAF ownership as the public site distribution.
  # checkov:skip=CKV_AWS_310:Origin failover waits for the approved RPO/RTO.
  # checkov:skip=CKV_AWS_305:Derivative URLs are object keys, not a website index.
  # checkov:skip=CKV_AWS_174:The CloudFront default certificate ignores minimum_protocol_version; ACM TLS waits for the media hostname.
  # checkov:skip=CKV2_AWS_42:A custom ACM certificate waits for the approved public media domain.
  # checkov:skip=CKV_AWS_374:Public veteran media must remain globally reachable; WAF is the approved traffic boundary.
  enabled             = true
  comment             = "${var.name} public media derivatives"
  default_root_object = ""
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  wait_for_deployment = false
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.derivatives.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.derivatives.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.derivatives.id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.derivatives.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.derivatives.id
    target_origin_id           = "s3-${aws_s3_bucket.derivatives.id}"
    viewer_protocol_policy     = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  logging_config {
    bucket          = "${var.access_log_bucket_name}.s3.amazonaws.com"
    include_cookies = false
    prefix          = "cloudfront/${var.name}-derivatives/"
  }
}

data "aws_iam_policy_document" "originals_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.originals.arn,
      "${aws_s3_bucket.originals.arn}/*",
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
    sid     = "DenyPublicPrincipals"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.originals.arn,
      "${aws_s3_bucket.originals.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:PrincipalType"
      values   = ["Anonymous"]
    }
  }

  statement {
    sid       = "AllowUploaderPrivatePuts"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["${aws_s3_bucket.originals.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [var.uploader_role_arn]
    }
  }
}

data "aws_iam_policy_document" "derivatives_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.derivatives.arn,
      "${aws_s3_bucket.derivatives.arn}/*",
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
    sid       = "AllowCloudFrontReadDerivatives"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.derivatives.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.derivatives.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_s3_bucket_policy" "originals" {
  bucket = aws_s3_bucket.originals.id
  policy = data.aws_iam_policy_document.originals_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.originals]
}

resource "aws_s3_bucket_policy" "derivatives" {
  bucket = aws_s3_bucket.derivatives.id
  policy = data.aws_iam_policy_document.derivatives_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.derivatives]
}

data "aws_iam_policy_document" "uploader" {
  statement {
    sid       = "PutPrivateOriginalsOnly"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["${aws_s3_bucket.originals.arn}/*"]
  }

  statement {
    sid       = "UseOriginalsKey"
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.originals.arn]
  }
}

resource "aws_iam_policy" "uploader" {
  name   = "${var.name}-media-uploader"
  policy = data.aws_iam_policy_document.uploader.json
  tags   = var.tags
}

resource "aws_cloudwatch_metric_alarm" "derivative_4xx" {
  alarm_name          = "${var.name}-media-derivative-4xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "Public media derivatives are returning elevated 4xx responses."
  alarm_actions       = [var.alarm_sns_topic_arn]
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    DistributionId = aws_cloudfront_distribution.derivatives.id
    Region         = "Global"
  }
}

resource "aws_cloudwatch_metric_alarm" "derivative_5xx" {
  alarm_name          = "${var.name}-media-derivative-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Public media derivatives are returning 5xx responses."
  alarm_actions       = [var.alarm_sns_topic_arn]
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    DistributionId = aws_cloudfront_distribution.derivatives.id
    Region         = "Global"
  }
}
