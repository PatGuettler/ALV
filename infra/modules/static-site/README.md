# Private static-site origin

This module owns the private S3 origin and its single bucket policy. It deliberately does not enable
S3 website hosting or anonymous reads. CloudFront Origin Access Control is added by issue #81; do not
create a second `aws_s3_bucket_policy` resource outside this module.

Required callers provide an existing dedicated access-log bucket and exact deployment role ARNs.
The deployment roles receive only bucket listing/location and object read/write/delete operations.
All other access comes from identity policies or the later distribution-scoped OAC statement.

Releases use versioning plus 90-day noncurrent retention by default. `force_destroy` is not exposed,
so Terraform cannot silently delete a populated origin bucket.
