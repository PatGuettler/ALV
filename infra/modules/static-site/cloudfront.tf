resource "aws_cloudfront_cache_policy" "html" {
  name        = "${var.bucket_name}-html"
  comment     = "Honor origin Cache-Control for HTML and other mutable objects"
  default_ttl = 0
  min_ttl     = 0
  max_ttl     = 300

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

resource "aws_cloudfront_cache_policy" "immutable" {
  name        = "${var.bucket_name}-immutable"
  comment     = "Long-lived cache for fingerprinted Astro assets"
  default_ttl = 31536000
  min_ttl     = 31536000
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

resource "aws_cloudfront_response_headers_policy" "site" {
  name    = "${var.bucket_name}-security"
  comment = "Browser security headers for the public Alabama Veteran site"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
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

    xss_protection {
      protection = true
      mode_block = true
      override   = true
    }
  }

  custom_headers_config {
    items {
      header   = "Content-Security-Policy"
      override = true
      value    = var.content_security_policy
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  # checkov:skip=CKV_AWS_310:Origin failover waits for the approved RPO/RTO in #63.
  # checkov:skip=CKV_AWS_174:The CloudFront default certificate ignores minimum_protocol_version until ACM aliases are attached.
  # checkov:skip=CKV2_AWS_42:A custom ACM certificate waits for the approved production hostname cutover.
  # checkov:skip=CKV_AWS_374:The public veteran site must remain globally reachable; WAF is the approved traffic boundary.
  comment             = "Alabama Veteran public static site"
  enabled             = true
  default_root_object = "index.html"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = var.price_class
  wait_for_deployment = false
  web_acl_id          = var.web_acl_id
  aliases             = var.aliases
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.origin.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.origin.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.origin.id
  }

  ordered_cache_behavior {
    path_pattern               = "_astro/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.immutable.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
    target_origin_id           = "s3-${aws_s3_bucket.origin.id}"
    viewer_protocol_policy     = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern               = "assets/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.immutable.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
    target_origin_id           = "s3-${aws_s3_bucket.origin.id}"
    viewer_protocol_policy     = "redirect-to-https"
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.html.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
    target_origin_id           = "s3-${aws_s3_bucket.origin.id}"
    viewer_protocol_policy     = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.directory_rewrite.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.acm_certificate_arn == "" ? [1] : []
    content {
      cloudfront_default_certificate = true
      minimum_protocol_version       = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.acm_certificate_arn == "" ? [] : [1]
    content {
      acm_certificate_arn      = var.acm_certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  logging_config {
    bucket          = var.cloudfront_log_bucket_domain_name
    include_cookies = false
    prefix          = var.cloudfront_log_prefix
  }
}

resource "aws_cloudwatch_metric_alarm" "site_4xx" {
  alarm_name          = "${var.bucket_name}-4xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 15
  alarm_description   = "Public site 4xx rate is elevated."
  alarm_actions       = [var.alarm_sns_topic_arn]
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }
}

resource "aws_cloudwatch_metric_alarm" "site_5xx" {
  alarm_name          = "${var.bucket_name}-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Public site 5xx responses are being served."
  alarm_actions       = [var.alarm_sns_topic_arn]
  treat_missing_data  = "notBreaching"
  tags                = var.tags

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }
}
