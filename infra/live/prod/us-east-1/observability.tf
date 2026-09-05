resource "aws_sns_topic" "alarms" {
  # checkov:skip=CKV_AWS_26:Alarm notifications contain metric names only; KMS waits for the shared ALV log key.
  name = "${local.resource_prefix}-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "retreat_api_5xx" {
  alarm_name          = "${local.resource_prefix}-retreat-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Warrior Retreat HTTP API is returning 5xx responses."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.retreat.id
    Stage = aws_apigatewayv2_stage.default.name
  }
}

resource "aws_cloudwatch_metric_alarm" "retreat_lambda_errors" {
  alarm_name          = "${local.resource_prefix}-retreat-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Warrior Retreat Lambda is failing."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.retreat_api.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "retreat_lambda_throttles" {
  alarm_name          = "${local.resource_prefix}-retreat-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Warrior Retreat Lambda is throttled. Request a concurrent-execution quota increase if this fires during an application window."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.retreat_api.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "retreat_lambda_concurrency" {
  alarm_name          = "${local.resource_prefix}-retreat-lambda-concurrency"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Maximum"
  threshold           = 8
  alarm_description   = "Retreat intake is near the new-account Lambda concurrency ceiling of 10. Raise the account quota before a large application window."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.retreat_api.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "applications_throttled" {
  alarm_name          = "${local.resource_prefix}-applications-throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "The Warrior Retreat applications table is throttling writes or reads."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.applications.name
  }
}

resource "aws_cloudwatch_metric_alarm" "applications_system_errors" {
  alarm_name          = "${local.resource_prefix}-applications-system-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "DynamoDB system errors on the Warrior Retreat applications table."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.applications.name
  }
}

resource "aws_cloudwatch_dashboard" "launch" {
  dashboard_name = "${local.resource_prefix}-launch"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "CloudFront requests and errors"
          region = "us-east-1"
          stat   = "Sum"
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", module.static_site.distribution.id, "Region", "Global"],
            [".", "5xxErrorRate", ".", ".", ".", ".", { stat = "Average" }],
            [".", "4xxErrorRate", ".", ".", ".", ".", { stat = "Average" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Retreat applications"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", aws_apigatewayv2_api.retreat.id, { stat = "Sum" }],
            [".", "5xx", ".", ".", { stat = "Sum" }],
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", aws_lambda_function.retreat_api.function_name, { stat = "Maximum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.applications.name, { stat = "Sum" }],
          ]
        }
      }
    ]
  })
}
