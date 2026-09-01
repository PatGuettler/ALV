# Private static-site origin

This module owns the private S3 origin, CloudFront Origin Access Control, and their single bucket
policy. It deliberately does not enable S3 website hosting or anonymous reads. Do not create a
second `aws_s3_bucket_policy` resource outside this module.

Required callers provide an existing dedicated access-log bucket and exact deployment role ARNs.
The deployment roles receive only bucket listing/location and object read/write/delete operations.
CloudFront receives read-only object access from its service principal, restricted by both the exact
distribution ARN and source account. The distribution must use the exported OAC ID with the S3
regional endpoint; never use the public S3 website endpoint.

Releases use versioning plus 90-day noncurrent retention by default. `force_destroy` is not exposed,
so Terraform cannot silently delete a populated origin bucket.
