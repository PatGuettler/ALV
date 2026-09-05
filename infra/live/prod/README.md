# ALV production (us-east-1)

Runs only in account `286801153738` (`keytrain-alv-prod`). Do not point this root at the KeyTrain
payer. This root provisions Warrior Retreat intake and the public S3/CloudFront site.

Staff login is **Cognito hosted UI**, not the Identity Center portal. GitHub Pages remains visual
staging until DNS cutover to the CloudFront distribution.

## Apply

Copy the example files locally (they are gitignored when populated). `alarm_email` must be set so
the launch SNS topic can be confirmed.

```bash
export AWS_PROFILE=alv
export AWS_DEFAULT_REGION=us-east-1
terraform -chdir=infra/live/prod/us-east-1 init -backend-config=infra/live/prod/us-east-1/prod.s3.tfbackend
terraform -chdir=infra/live/prod/us-east-1 plan
terraform -chdir=infra/live/prod/us-east-1 apply
```

After apply, confirm the SNS subscription email and copy these outputs into the GitHub `production`
Environment:

- `AWS_PRODUCTION_ACCOUNT_ID=286801153738`
- `AWS_PRODUCTION_BUCKET` = `site_origin_bucket`
- `AWS_PRODUCTION_DISTRIBUTION_ID` = `site_distribution_id`
- `AWS_PRODUCTION_DEPLOY_ROLE_ARN` = `github_site_deploy_role_arn`
- `PRODUCTION_URL` = `site_url` until `alabamaveteran.org` aliases are attached

Request a Lambda concurrent-execution quota increase above 10 before a large Warrior Retreat
application window. DynamoDB is on-demand and does not need pre-provisioned capacity.

`assume_role_arn` should be `arn:aws:iam::286801153738:role/OrganizationAccountAccessRole` when the
CLI profile is the payer IAM user. State stays in `keytrain-org-tfstate` at
`alv/prod/us-east-1/terraform.tfstate`.
