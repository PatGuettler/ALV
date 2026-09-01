output "certificate" {
  description = "Validated certificate identifiers consumed by CloudFront and monitoring."
  value = {
    arn         = aws_acm_certificate_validation.site.certificate_arn
    domain_name = aws_acm_certificate.site.domain_name
    status      = aws_acm_certificate.site.status
  }
}

output "records" {
  description = "Managed public hostnames and authoritative zone for cutover evidence."
  value = {
    zone_id      = var.route53_zone_id
    domain_names = local.domain_names
    ipv4_fqdns   = [for record in aws_route53_record.site_ipv4 : record.fqdn]
    ipv6_fqdns   = [for record in aws_route53_record.site_ipv6 : record.fqdn]
  }
}
