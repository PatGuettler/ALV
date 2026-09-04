data "aws_iam_policy_document" "lambda_assume" {
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

data "aws_iam_policy_document" "lambda" {
  statement {
    sid    = "WriteEventsSyncLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.events_sync.arn}:*"]
  }

  statement {
    sid       = "ReadWriteEventsFeedObject"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.feed.arn}/${var.feed_object_key}"]
  }

  statement {
    sid       = "ReadGhlToken"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.ghl_token.arn]
  }

  statement {
    sid       = "SendFailedSyncToDlq"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.events_sync_dlq.arn]
  }
}

resource "aws_iam_role" "events_sync" {
  name               = "${var.name}-events-sync"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "events_sync" {
  name   = "${var.name}-events-sync"
  role   = aws_iam_role.events_sync.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_cloudwatch_log_group" "events_sync" {
  # checkov:skip=CKV_AWS_158:CloudWatch default encryption is approved until the shared ALV log KMS key exists.
  name              = "/aws/lambda/${var.name}-events-sync"
  retention_in_days = var.log_retention_days
}

resource "aws_sqs_queue" "events_sync_dlq" {
  # checkov:skip=CKV_AWS_372:This queue is the sync failure destination; a second DLQ is not required.
  name                      = "${var.name}-events-sync-dlq"
  sqs_managed_sse_enabled   = true
  message_retention_seconds = 1209600
}

data "aws_iam_policy_document" "dlq" {
  statement {
    sid       = "AllowSchedulerFailures"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.events_sync_dlq.arn]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_sqs_queue_policy" "events_sync_dlq" {
  queue_url = aws_sqs_queue.events_sync_dlq.id
  policy    = data.aws_iam_policy_document.dlq.json
}

resource "aws_secretsmanager_secret" "ghl_token" {
  # checkov:skip=CKV_AWS_149:The GHL token uses the AWS-managed Secrets Manager key; a CMK waits for the shared ALV secrets key.
  # checkov:skip=CKV2_AWS_57:GHL private integration tokens are rotated in GoHighLevel, not by Secrets Manager rotation Lambdas.
  name                    = "${var.name}-ghl-events-token"
  description             = "GoHighLevel private integration token for the public events calendar"
  recovery_window_in_days = 7
}

resource "aws_lambda_function" "events_sync" {
  # checkov:skip=CKV_AWS_50:X-Ray requires wildcard IAM that this repository forbids; CloudWatch logs are the approved trace path.
  # checkov:skip=CKV_AWS_115:New ALV accounts start at 10 unreserved executions; reserved concurrency would drop that below AWS minimum.
  # checkov:skip=CKV_AWS_117:This sync function must reach the public GHL API; no private subnet or NAT is provisioned.
  # checkov:skip=CKV_AWS_173:Environment values are bucket, object key, secret ARN, and public GHL IDs, not the token.
  # checkov:skip=CKV_AWS_272:Code signing is not in the initial ALV control set.
  filename         = data.archive_file.events_sync.output_path
  source_code_hash = data.archive_file.events_sync.output_base64sha256
  function_name    = "${var.name}-events-sync"
  role             = aws_iam_role.events_sync.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  timeout          = 20
  memory_size      = 256
  architectures    = ["x86_64"]

  environment {
    variables = {
      FEED_BUCKET            = aws_s3_bucket.feed.id
      FEED_OBJECT_KEY        = var.feed_object_key
      GHL_TOKEN_SECRET_ARN   = aws_secretsmanager_secret.ghl_token.arn
      GHL_LOCATION_ID        = var.ghl_location_id
      GHL_EVENTS_CALENDAR_ID = var.ghl_events_calendar_id
    }
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.events_sync_dlq.arn
  }

  depends_on = [
    aws_cloudwatch_log_group.events_sync,
    aws_iam_role_policy.events_sync,
  ]
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    sid     = "SchedulerAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    sid       = "InvokeEventsSync"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.events_sync.arn]
  }

  statement {
    sid       = "SendSchedulerFailures"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.events_sync_dlq.arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name}-events-sync-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "${var.name}-events-sync-scheduler"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "events_sync" {
  # checkov:skip=CKV_AWS_297:The schedule payload is an empty Lambda invoke; the GHL token lives in Secrets Manager, not the EventBridge input.
  name                         = "${var.name}-events-sync"
  description                  = "Refresh the public AV Events Calendar feed from GoHighLevel"
  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = "UTC"
  state                        = "ENABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.events_sync.arn
    role_arn = aws_iam_role.scheduler.arn

    retry_policy {
      maximum_event_age_in_seconds = 300
      maximum_retry_attempts       = 2
    }

    dead_letter_config {
      arn = aws_sqs_queue.events_sync_dlq.arn
    }
  }

  depends_on = [aws_iam_role_policy.scheduler]
}
