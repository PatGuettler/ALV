output "origin_bucket" {
  description = "Private web-origin bucket identifiers."
  value = {
    id                   = aws_s3_bucket.origin.id
    arn                  = aws_s3_bucket.origin.arn
    regional_domain_name = aws_s3_bucket.origin.bucket_regional_domain_name
  }
}
