data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "retreat_kms" {
  # checkov:skip=CKV_AWS_356:KMS key policies require Resource "*" because the policy is attached to the key being created.
  # checkov:skip=CKV_AWS_111:This standard account-root statement delegates key administration to scoped IAM policies in this account only.
  # checkov:skip=CKV_AWS_109:Permission management is deliberately limited to this AWS account's root principal and then constrained by IAM.
  statement {
    sid       = "EnableAccountIAMPolicies"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
}

resource "aws_kms_key" "retreat" {
  description             = "Encrypt ALV Warrior Retreat application and audit data"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.retreat_kms.json
}

resource "aws_kms_alias" "retreat" {
  name          = "alias/${local.resource_prefix}-retreat-data"
  target_key_id = aws_kms_key.retreat.key_id
}

resource "aws_dynamodb_table" "applications" {
  name         = "${local.resource_prefix}-applications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "submittedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "status-submitted-index"
    hash_key        = "status"
    range_key       = "submittedAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.retreat.arn
  }

  deletion_protection_enabled = true
}

resource "aws_dynamodb_table" "application_audit" {
  name         = "${local.resource_prefix}-application-audit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.retreat.arn
  }

  deletion_protection_enabled = true
}
