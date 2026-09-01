# CloudFront edge security and logs

This module creates the CloudFront-scope WAF, redacted WAF logging, and private CloudFront standard
log bucket consumed by the static-site module. The initial web ACL blocks AWS-managed common,
known-bad-input, and IP-reputation findings and applies a configurable per-IP rate limit.

WAF logs are encrypted with a dedicated rotating KMS key and redact `Authorization` and `Cookie`
headers. CloudFront logs use SSE-S3 because the distribution's standard logging integration must be
able to deliver them; request bodies are not included. Both stores have explicit retention and the
S3 bucket also sends access logs to the caller's central logging boundary.

Apply in `us-east-1`, which is required for resources attached to a global CloudFront distribution.
Tune the rate limit only after #63 traffic targets are approved and test changes in nonproduction.
