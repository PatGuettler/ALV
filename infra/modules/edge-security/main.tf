terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.62.0"
    }
  }
}

locals {
  waf_log_group_name = "aws-waf-logs-${var.name}"
  waf_log_group_arn  = "arn:aws:logs:us-east-1:${var.aws_account_id}:log-group:${local.waf_log_group_name}"
}

resource "aws_kms_key" "waf_logs" {
  description             = "Encrypt ${var.name} WAF logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.waf_log_key.json
  tags                    = var.tags
}

resource "aws_kms_alias" "waf_logs" {
  name          = "alias/${var.name}-waf-logs"
  target_key_id = aws_kms_key.waf_logs.key_id
}

data "aws_iam_policy_document" "waf_log_key" {
  # checkov:skip=CKV_AWS_356:KMS key-policy Resource "*" means only the key carrying this policy; principals are account/service scoped.
  # checkov:skip=CKV_AWS_111:KMS key-policy write actions apply only to this key and CloudWatch Logs is constrained by encryption context and ViaService.
  # checkov:skip=CKV_AWS_109:The account-root administration statement prevents an unrecoverable key and delegates no cross-account access.
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
    sid    = "AllowCloudWatchLogsEncryption"
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]
    resources = ["*"]

    principals {
      type        = "Service"
      identifiers = ["logs.us-east-1.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = [local.waf_log_group_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["logs.us-east-1.amazonaws.com"]
    }
  }
}

resource "aws_cloudwatch_log_group" "waf" {
  name              = local.waf_log_group_name
  kms_key_id        = aws_kms_key.waf_logs.arn
  retention_in_days = var.waf_log_retention_days
  skip_destroy      = false
  tags              = var.tags
}

resource "aws_wafv2_web_acl" "edge" {
  name        = var.name
  description = "Managed protections and rate controls for the ALV public site"
  scope       = "CLOUDFRONT"
  tags        = var.tags

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 30

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "IpRateLimit"
    priority = 100

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = var.rate_limit_requests
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "edge" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn            = aws_wafv2_web_acl.edge.arn

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

resource "aws_s3_bucket" "edge_logs" {
  # checkov:skip=CKV_AWS_145:CloudFront standard logging uses SSE-S3 for service compatibility; these logs contain no request bodies and WAF logs use KMS.
  # checkov:skip=CKV_AWS_144:Cross-region replication depends on the customer-approved RPO/RTO in #63; version recovery is enabled now.
  # checkov:skip=CKV2_AWS_62:Edge log objects have no approved event consumer; WAF and CloudWatch alarms are implemented by focused observability issues.
  bucket = var.edge_log_bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_ownership_controls" "edge_logs" {
  # checkov:skip=CKV2_AWS_65:CloudFront standard logging v1 requires ACL-capable S3 ownership; all public ACLs and policies remain blocked.
  bucket = aws_s3_bucket.edge_logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "edge_logs" {
  bucket = aws_s3_bucket.edge_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "edge_logs" {
  bucket = aws_s3_bucket.edge_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "edge_logs" {
  bucket = aws_s3_bucket.edge_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "edge_logs" {
  bucket        = aws_s3_bucket.edge_logs.id
  target_bucket = var.access_log_bucket_name
  target_prefix = var.access_log_prefix
}

resource "aws_s3_bucket_lifecycle_configuration" "edge_logs" {
  bucket = aws_s3_bucket.edge_logs.id

  depends_on = [aws_s3_bucket_versioning.edge_logs]

  rule {
    id     = "edge-log-retention"
    status = "Enabled"

    filter {}

    expiration {
      days = var.edge_log_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "edge_logs" {
  bucket = aws_s3_bucket.edge_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.edge_logs.arn, "${aws_s3_bucket.edge_logs.arn}/*"]
        Principal = "*"
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid      = "AllowCloudFrontStandardLogs"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.edge_logs.arn}/*"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = var.aws_account_id
          }
        }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.edge_logs]
}
