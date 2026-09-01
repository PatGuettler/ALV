# ALV production (us-east-1)

Runs only in account `286801153738` (`keytrain-alv-prod`). Do not point this root at the KeyTrain
payer. Warrior Retreat intake (Cognito staff login, DynamoDB, HTTP API, Lambda) is provisioned here.
GitHub Pages remains the public visual site until DNS cutover.

Staff login is **Cognito hosted UI**, not the Identity Center portal.

## Apply

Copy the example files locally (they are gitignored when populated):

```bash
export AWS_PROFILE=alv
export AWS_DEFAULT_REGION=us-east-1
terraform -chdir=infra/live/prod/us-east-1 init -backend-config=infra/live/prod/us-east-1/prod.s3.tfbackend
terraform -chdir=infra/live/prod/us-east-1 plan
terraform -chdir=infra/live/prod/us-east-1 apply
```

`assume_role_arn` should be `arn:aws:iam::286801153738:role/OrganizationAccountAccessRole` when the
CLI profile is the payer IAM user. State stays in `keytrain-org-tfstate` at
`alv/prod/us-east-1/terraform.tfstate`.
