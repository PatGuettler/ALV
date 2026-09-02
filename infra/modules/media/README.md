# Private media originals and public derivatives

This module stores veteran media originals in a KMS-encrypted, fully public-access-blocked S3
bucket. Optimized derivatives live in a second blocked bucket and are readable only through
CloudFront Origin Access Control. Uploaders can `PutObject` on originals and cannot attach a public
ACL or bucket policy.

Do not wire anonymous S3 website hosting. Do not grant `s3:PutBucketAcl`, `s3:PutObjectAcl`, or
`s3:PutBucketPolicy` to the uploader role. The live prod root does not instantiate this module until
the dedicated access-log bucket, uploader role, and alarm topic exist.
