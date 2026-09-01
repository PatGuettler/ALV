locals {
  origin_id = "s3-${var.bucket_name}"
}

check "certificate_belongs_to_account" {
  assert {
    condition = startswith(
      var.acm_certificate_arn,
      "arn:aws:acm:us-east-1:${var.aws_account_id}:certificate/",
    )
    error_message = "acm_certificate_arn must be a us-east-1 certificate owned by aws_account_id."
  }
}

resource "aws_cloudfront_function" "directory_rewrite" {
  name    = "${var.distribution_name}-directory-rewrite"
  comment = "Resolve ALV static directory routes without an SPA fallback"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/functions/directory-rewrite.js")
}

resource "aws_cloudfront_cache_policy" "html" {
  name        = "${var.distribution_name}-html"
  comment     = "Short-lived HTML and mutable ALV site content"
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
  name        = "${var.distribution_name}-immutable"
  comment     = "One-year cache for fingerprinted Astro assets"
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
  name    = "${var.distribution_name}-security"
  comment = "Browser security headers for the ALV public site"

  security_headers_config {
    content_security_policy {
      content_security_policy = var.content_security_policy
      override                = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
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
      header   = "Permissions-Policy"
      value    = "camera=(), geolocation=(), microphone=()"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  # checkov:skip=CKV_AWS_310:A secondary origin depends on the customer-approved RPO/RTO and recovery design in #63/#93; S3 version recovery is enabled now.
  # checkov:skip=CKV_AWS_374:Public veteran resources must remain globally reachable; WAF and rate controls are the approved traffic boundary.
  # checkov:skip=CKV2_AWS_47:The WAF is supplied by #84 and its managed-rule assertions are tested in that focused module rather than duplicated here.
  aliases             = var.domain_aliases
  comment             = "${var.distribution_name} public website"
  default_root_object = "index.html"
  enabled             = true
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = var.price_class
  retain_on_delete    = true
  wait_for_deployment = true
  web_acl_id          = var.web_acl_arn
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.origin.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.origin.id
    origin_id                = local.origin_id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    cache_policy_id            = aws_cloudfront_cache_policy.html.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.directory_rewrite.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "_astro/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    cache_policy_id            = aws_cloudfront_cache_policy.immutable.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
  }

  custom_error_response {
    error_caching_min_ttl = 60
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 60
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404/index.html"
  }

  logging_config {
    bucket          = var.cloudfront_log_bucket_domain_name
    include_cookies = false
    prefix          = var.cloudfront_log_prefix
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }
}
