resource "aws_cloudfront_origin_access_control" "feed" {
  name                              = "${var.name}-events-feed"
  description                       = "Signed CloudFront access to ${local.feed_bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "feed" {
  name        = "${var.name}-events-feed"
  comment     = "Short-lived public events calendar JSON"
  default_ttl = 15
  min_ttl     = 0
  max_ttl     = 30

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

resource "aws_cloudfront_response_headers_policy" "feed" {
  name    = "${var.name}-events-feed"
  comment = "CORS and security headers for the public events JSON feed"

  cors_config {
    access_control_allow_credentials = false
    access_control_max_age_sec       = 86400
    origin_override                  = true

    access_control_allow_headers {
      items = ["Accept"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD"]
    }

    access_control_allow_origins {
      items = var.allowed_origins
    }
  }

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "no-referrer"
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
}

resource "aws_cloudfront_distribution" "feed" {
  # checkov:skip=CKV_AWS_68:WAF attachment is owned by the edge-security module (#84) at the live root.
  # checkov:skip=CKV2_AWS_47:Same WAF ownership as the public site distribution.
  # checkov:skip=CKV_AWS_86:CloudFront standard logging waits for the ACL-compatible log bucket from #84.
  # checkov:skip=CKV_AWS_310:Origin failover waits for the approved RPO/RTO in #63/#93.
  # checkov:skip=CKV_AWS_305:This distribution serves one JSON object, not a website index.
  # checkov:skip=CKV_AWS_174:The CloudFront default certificate ignores minimum_protocol_version; ACM TLS waits for a staging hostname.
  # checkov:skip=CKV2_AWS_42:A custom ACM certificate waits for the approved staging domain.
  # checkov:skip=CKV_AWS_374:Public event listings must remain globally reachable; WAF is the approved traffic boundary.
  comment             = "${var.name} public events calendar feed"
  enabled             = true
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  wait_for_deployment = false
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.feed.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.feed.id
    origin_id                = local.origin_id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.feed.id
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.feed.id
    target_origin_id           = local.origin_id
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
}
