resource "aws_cloudwatch_log_group" "retreat_http" {
  # checkov:skip=CKV_AWS_158:CloudWatch default encryption is approved until the shared ALV log KMS key exists.
  name              = "/aws/apigateway/${local.resource_prefix}-retreat"
  retention_in_days = 365
}

data "aws_iam_policy_document" "retreat_http_logs" {
  statement {
    sid    = "ApiGatewayWriteLogs"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.retreat_http.arn}:*"]
  }
}

resource "aws_cloudwatch_log_resource_policy" "retreat_http" {
  policy_name     = "${local.resource_prefix}-retreat-http-logs"
  policy_document = data.aws_iam_policy_document.retreat_http_logs.json
}

resource "aws_apigatewayv2_api" "retreat" {
  name          = "${local.resource_prefix}-retreat"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = true
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_origins     = var.retreat_allowed_origins
    max_age           = 3600
  }
}

resource "aws_apigatewayv2_authorizer" "staff" {
  api_id           = aws_apigatewayv2_api.retreat.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.resource_prefix}-retreat-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.staff.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.staff.id}"
  }
}

resource "aws_apigatewayv2_integration" "retreat" {
  api_id                 = aws_apigatewayv2_api.retreat.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.retreat_api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "public_create" {
  # checkov:skip=CKV_AWS_309:Public POST is the veteran intake path; staff routes require JWT.
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "POST /v1/applications"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "staff_list" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "GET /v1/staff/applications"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_get" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "GET /v1/staff/applications/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_patch" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "PATCH /v1/staff/applications/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_me" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "GET /v1/staff/me"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_users" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "GET /v1/staff/users"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_invite" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "POST /v1/staff/users"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_user_patch" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "PATCH /v1/staff/users/{username}"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_route" "staff_user_delete" {
  api_id             = aws_apigatewayv2_api.retreat.id
  route_key          = "DELETE /v1/staff/users/{username}"
  target             = "integrations/${aws_apigatewayv2_integration.retreat.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.staff.id
}

resource "aws_apigatewayv2_stage" "default" {
  # checkov:skip=CKV_AWS_73:HTTP APIs do not expose X-Ray tracing; access logs go to CloudWatch.
  # checkov:skip=CKV_AWS_120:API caching is not used; staff reads are authorized and short-lived.
  api_id      = aws_apigatewayv2_api.retreat.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.retreat_http.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  depends_on = [aws_cloudwatch_log_resource_policy.retreat_http]
}

resource "aws_lambda_permission" "retreat_http" {
  statement_id  = "AllowRetreatHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.retreat_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.retreat.execution_arn}/*/*"
}
