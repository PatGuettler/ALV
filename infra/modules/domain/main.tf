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
  domain_names = setunion([var.primary_domain], var.alternate_domains)
}

check "primary_domain_is_not_repeated" {
  assert {
    condition     = !contains(var.alternate_domains, var.primary_domain)
    error_message = "alternate_domains must not repeat primary_domain."
  }
}

resource "aws_acm_certificate" "site" {
  domain_name               = var.primary_domain
  subject_alternative_names = sort(tolist(var.alternate_domains))
  validation_method         = "DNS"
  key_algorithm             = "RSA_2048"
  tags                      = var.tags

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = {
    for option in aws_acm_certificate.site.domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  allow_overwrite = true
  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 300
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn = aws_acm_certificate.site.arn
  validation_record_fqdns = [
    for record in aws_route53_record.validation : record.fqdn
  ]
}

resource "aws_route53_record" "site_ipv4" {
  for_each = local.domain_names

  zone_id = var.route53_zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = var.distribution_domain_name
    zone_id                = var.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_ipv6" {
  for_each = local.domain_names

  zone_id = var.route53_zone_id
  name    = each.value
  type    = "AAAA"

  alias {
    name                   = var.distribution_domain_name
    zone_id                = var.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}
