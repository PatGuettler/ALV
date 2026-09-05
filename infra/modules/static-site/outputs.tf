output "origin_bucket" {
  description = "Private origin bucket consumed by the production upload workflow."
  value = {
    id  = aws_s3_bucket.origin.id
    arn = aws_s3_bucket.origin.arn
  }
}

output "distribution" {
  description = "CloudFront distribution that is the only public read path for the site."
  value = {
    id             = aws_cloudfront_distribution.site.id
    arn            = aws_cloudfront_distribution.site.arn
    domain_name    = aws_cloudfront_distribution.site.domain_name
    hosted_zone_id = aws_cloudfront_distribution.site.hosted_zone_id
    url            = "https://${aws_cloudfront_distribution.site.domain_name}"
  }
}
