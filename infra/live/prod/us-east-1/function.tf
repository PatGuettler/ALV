data "archive_file" "retreat_api" {
  type        = "zip"
  source_dir  = "${path.module}/../../../functions/retreat-api"
  output_path = "${path.module}/../../../functions/retreat-api/retreat-api.zip"
  excludes    = ["*.zip"]
}

data "aws_iam_policy_document" "retreat_assume" {
  statement {
    sid     = "LambdaAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "retreat_api" {
  statement {
    sid    = "WriteRetreatLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.retreat_api.arn}:*"]
  }

  statement {
    sid    = "WriteApplications"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = [
      aws_dynamodb_table.applications.arn,
      "${aws_dynamodb_table.applications.arn}/index/status-submitted-index",
    ]
  }
}

resource "aws_iam_role" "retreat_api" {
  name               = "${local.resource_prefix}-retreat-api"
  assume_role_policy = data.aws_iam_policy_document.retreat_assume.json
}

resource "aws_iam_role_policy" "retreat_api" {
  name   = "${local.resource_prefix}-retreat-api"
  role   = aws_iam_role.retreat_api.id
  policy = data.aws_iam_policy_document.retreat_api.json
}

resource "aws_cloudwatch_log_group" "retreat_api" {
  # checkov:skip=CKV_AWS_158:CloudWatch default encryption is approved until the shared ALV log KMS key exists.
  name              = "/aws/lambda/${local.resource_prefix}-retreat-api"
  retention_in_days = 365
}

resource "aws_lambda_function" "retreat_api" {
  # checkov:skip=CKV_AWS_50:X-Ray requires wildcard IAM that this repository forbids; CloudWatch logs are the approved trace path.
  # checkov:skip=CKV_AWS_115:New ALV prod accounts start at 10 unreserved executions; reserved concurrency would drop that below AWS minimum.
  # checkov:skip=CKV_AWS_116:A dedicated DLQ follows the classified-field review; failed writes already return 5xx to the client.
  # checkov:skip=CKV_AWS_117:This public intake function is not VPC-bound; no private subnet or NAT is provisioned yet.
  # checkov:skip=CKV_AWS_173:Environment values are table name and CORS origins, not secrets.
  # checkov:skip=CKV_AWS_272:Code signing is not in the initial ALV prod control set.
  filename         = data.archive_file.retreat_api.output_path
  source_code_hash = data.archive_file.retreat_api.output_base64sha256
  function_name    = "${local.resource_prefix}-retreat-api"
  role             = aws_iam_role.retreat_api.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  timeout          = 10
  memory_size      = 256
  architectures    = ["x86_64"]

  environment {
    variables = {
      TABLE_NAME      = aws_dynamodb_table.applications.name
      ALLOWED_ORIGINS = join(",", var.retreat_allowed_origins)
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.retreat_api,
    aws_iam_role_policy.retreat_api,
  ]
}
