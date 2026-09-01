resource "aws_dynamodb_table" "applications" {
  # checkov:skip=CKV_AWS_119:AWS-managed encryption is approved for this first retreat table; a customer KMS key follows the classified-field review.
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
    enabled = true
  }

  deletion_protection_enabled = true
}
