mock_provider "aws" {}

override_resource {
  target          = aws_acm_certificate.site
  override_during = plan
  values = {
    arn    = "arn:aws:acm:us-east-1:111111111111:certificate/12345678-1234-1234-1234-123456789abc"
    status = "ISSUED"
    domain_validation_options = [
      {
        domain_name           = "www.example.com"
        resource_record_name  = "_validation.www.example.com"
        resource_record_type  = "CNAME"
        resource_record_value = "_target.acm-validations.aws"
      },
      {
        domain_name           = "example.com"
        resource_record_name  = "_validation.example.com"
        resource_record_type  = "CNAME"
        resource_record_value = "_target-apex.acm-validations.aws"
      },
    ]
  }
}

variables {
  primary_domain              = "www.example.com"
  alternate_domains           = ["example.com"]
  route53_zone_id             = "Z1234567890ABC"
  distribution_domain_name    = "d1234567890abc.cloudfront.net"
  distribution_hosted_zone_id = "Z2FDTNDATAQYW2"
  tags = {
    Project     = "alabama-veteran"
    Environment = "test"
    ManagedBy   = "terraform"
  }
}

run "certificate_and_alias_defaults" {
  command = plan

  assert {
    condition     = aws_acm_certificate.site.validation_method == "DNS"
    error_message = "The public certificate must use DNS validation."
  }

  assert {
    condition     = aws_acm_certificate.site.key_algorithm == "RSA_2048"
    error_message = "The certificate must use the broadly compatible RSA 2048 algorithm."
  }

  assert {
    condition     = length(aws_route53_record.validation) == 2
    error_message = "Every certificate hostname must have a validation record."
  }

  assert {
    condition = (
      length(aws_route53_record.site_ipv4) == 2 &&
      length(aws_route53_record.site_ipv6) == 2
    )
    error_message = "Every approved hostname must receive A and AAAA aliases."
  }

  assert {
    condition = alltrue([
      for record in aws_route53_record.site_ipv4 :
      one(record.alias).name == "d1234567890abc.cloudfront.net"
    ])
    error_message = "Every public alias must target the approved CloudFront distribution."
  }
}

run "reject_repeated_primary_domain" {
  command = plan

  variables {
    alternate_domains = ["www.example.com"]
  }

  expect_failures = [check.primary_domain_is_not_repeated]
}
