# ALV nonprod / staging (us-east-1)

Runs only in account `177258422136` (`keytrain-alv-nonprod`). Do not point this root at the KeyTrain
payer. The public events calendar feed (GHL sync Lambda, private S3 origin, CloudFront) is
provisioned here so GitHub Pages staging can poll live appointments without waiting for a site
rebuild.

## Apply

Copy the example files locally (they are gitignored when populated):

```bash
export AWS_PROFILE=alv
export AWS_DEFAULT_REGION=us-east-1
terraform -chdir=infra/live/nonprod/us-east-1 init -backend-config=infra/live/nonprod/us-east-1/nonprod.s3.tfbackend
terraform -chdir=infra/live/nonprod/us-east-1 plan
terraform -chdir=infra/live/nonprod/us-east-1 apply
```

`assume_role_arn` should be `arn:aws:iam::177258422136:role/OrganizationAccountAccessRole` when the
CLI profile is the payer IAM user. State stays in `keytrain-org-tfstate` at
`alv/nonprod/us-east-1/terraform.tfstate`.

After apply:

1. Put the GoHighLevel private integration token into Secrets Manager using the
   `events_feed_secret_name` output. Do not put that token in Terraform variables or GitHub Pages.
2. Set the GitHub Actions variable `PUBLIC_EVENTS_FEED_URL` to the `events_feed_url` output so
   staging Pages polls this CloudFront feed.
3. EventBridge Scheduler runs every minute (AWS minimum). The events page already polls every 30
   seconds, so visitors see a new appointment about a minute after it lands in GHL.
