output "originals_bucket" {
  description = "Private originals bucket. Never grant public ACL or policy access."
  value = {
    id  = aws_s3_bucket.originals.id
    arn = aws_s3_bucket.originals.arn
  }
}

output "derivatives_distribution" {
  description = "CloudFront distribution that is the only public read path for derivatives."
  value = {
    id          = aws_cloudfront_distribution.derivatives.id
    domain_name = aws_cloudfront_distribution.derivatives.domain_name
  }
}

output "uploader_policy_arn" {
  description = "Least-privilege policy for writing original objects."
  value       = aws_iam_policy.uploader.arn
}
