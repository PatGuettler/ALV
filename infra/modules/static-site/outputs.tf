output "origin_bucket" {
  description = "Private web-origin bucket identifiers."
  value = {
    id                   = aws_s3_bucket.origin.id
    arn                  = aws_s3_bucket.origin.arn
    regional_domain_name = aws_s3_bucket.origin.bucket_regional_domain_name
  }
}

output "origin_access_control" {
  description = "CloudFront Origin Access Control identifiers used by the distribution."
  value = {
    id   = aws_cloudfront_origin_access_control.origin.id
    name = aws_cloudfront_origin_access_control.origin.name
  }
}

output "distribution" {
  description = "CloudFront identifiers used by DNS, deployment, monitoring, and smoke tests."
  value = {
    id             = aws_cloudfront_distribution.site.id
    arn            = aws_cloudfront_distribution.site.arn
    domain_name    = aws_cloudfront_distribution.site.domain_name
    hosted_zone_id = aws_cloudfront_distribution.site.hosted_zone_id
  }
}
