# keyTrain organization Terraform

**Applied 2026-08-31** in payer `607292335442`. Organization `o-g8wnpu966s` was imported. ALV accounts
`177258422136` (nonprod) and `286801153738` (prod) exist. Pickup details:
[PRODUCTION_PLAN.md current AWS status](../../../PRODUCTION_PLAN.md#current-aws-status-2026-08-31--pick-up-here).

This root runs in the **existing keyTrain AWS account** (the payer). Clickops already in that
account is left alone: this root only creates Organizations, product tenant accounts, a budget, and
the ALV Identity Center login.

All AWS charges stay on the keyTrain bill. ALV vs Halo vs other products are separate **member
accounts** (tenants) so Cost Explorer and logins stay split.

## ALV tenant

ALV is not a second AWS bill. It is:

1. Member accounts `keytrain-alv-nonprod` and `keytrain-alv-prod`
2. An Identity Center group `alv-operators` whose portal tiles open **only** those accounts
3. Later, Alabama Veteran staff (Chris) use Cognito on the ALV site — not the AWS console

KeyTrain engineers log in once at the Identity Center start URL, then pick the ALV account. That
session cannot see Halo or the clickops resources in the payer account.

## Manual steps (existing keyTrain account)

1. Confirm you are in the keyTrain payer: `aws sts get-caller-identity`
2. If this account is not already an AWS Organization management account, the first apply creates
   the organization. If an organization already exists:

   ```bash
   aws organizations describe-organization --query Organization.Id --output text
   terraform -chdir=infra/live/org/us-east-1 import aws_organizations_organization.keytrain o-xxxxxxxxxx
   ```

3. Enable **IAM Identity Center** in this account (Identity Center directory, not Active Directory).
   Terraform cannot turn that singleton on. After it exists, the next apply creates the ALV group
   and account assignments.
4. Create a **new** private state bucket (do not reuse a clickops bucket):

   ```bash
   aws s3api create-bucket --bucket keytrain-org-tfstate --region us-east-1
   aws s3api put-public-access-block --bucket keytrain-org-tfstate --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-versioning --bucket keytrain-org-tfstate --versioning-configuration Status=Enabled
   aws s3api put-bucket-encryption --bucket keytrain-org-tfstate --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```

5. Copy `us-east-1/terraform.tfvars.example` to an uncommitted `terraform.tfvars`.
6. Set `management_account_id` to this keyTrain account.
7. Give each new tenant account a unique email that is not already an AWS account.
8. For an ALV-only first apply, keep only the `alv-nonprod` and `alv-prod` keys in `accounts`.
9. Optionally set `alv_operators` so those people get the ALV portal tiles.

Then:

```bash
terraform -chdir=infra/live/org/us-east-1 init -backend-config=/secure/path/org.s3.tfbackend
terraform -chdir=infra/live/org/us-east-1 plan -var-file=/secure/path/org.tfvars
terraform -chdir=infra/live/org/us-east-1 apply -var-file=/secure/path/org.tfvars
```

## What Terraform will not do

- Import, change, or delete clickops resources in the keyTrain payer
- Close member accounts on `destroy`
- Deploy the ALV website (that is `infra/live/nonprod` and `infra/live/prod`, locked to the ALV
  account IDs)

After an account exists, do not remove it from `accounts`. Closing an AWS account is a separate
operator action.
