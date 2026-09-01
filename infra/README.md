# Terraform infrastructure

keyTrain owns the AWS Organization. Alabama Veteran (ALV) is one product under the websites OU,
alongside other keyTrain products. GitHub Pages remains public visual staging for this ALV site.

## Roots

| Root                     | Runs in                         | Creates                                                        |
| ------------------------ | ------------------------------- | -------------------------------------------------------------- |
| `live/org/us-east-1`     | Existing keyTrain payer account | Organization, tenant accounts, ALV Identity Center assignments |
| `live/nonprod/us-east-1` | ALV nonprod `177258422136` only | ALV website/API resources                                      |
| `live/prod/us-east-1`    | ALV prod `286801153738` only    | ALV website/API resources                                      |

Clickops in the keyTrain payer stays unmanaged. Org Terraform does not import it. ALV workload roots
use `allowed_account_ids` set to the ALV member account IDs from org outputs, never the payer.

## Boundaries

- Terraform workspaces are not an environment boundary.
- Every provider is restricted with `allowed_account_ids` so an incorrect credential fails before
  resource changes.
- Remote state configuration is supplied at initialization time from an uncommitted backend file.
- Do not import clickops resources into these roots.

## Naming and tags

Organization resources use the prefix `keytrain-`. ALV workload resources use `alv-<environment>`.
Modules must accept that prefix rather than inventing independent names.

Every supported ALV workload resource inherits these provider default tags:

- `Project=alabama-veteran`
- `Environment=nonprod|prod`
- `ManagedBy=terraform`
- `Owner=<approved owner>`
- `CostCenter=<approved cost center>`
- `DataClassification=public|internal|confidential|restricted`

Org resources additionally tag `Company=keytrain`. Never put secrets, email addresses used as
credentials, or private customer data in variables, tfvars, outputs, state keys, or tags.

## Local validation

Copy the example tfvars/backend files outside the repository, replace placeholders, authenticate to
the intended account with IAM Identity Center, and then run:

```bash
terraform -chdir=infra/live/org/us-east-1 init -backend=false
terraform -chdir=infra/live/org/us-east-1 validate

terraform -chdir=infra/live/nonprod/us-east-1 init -backend=false
terraform -chdir=infra/live/nonprod/us-east-1 validate

terraform -chdir=infra/live/prod/us-east-1 init -backend=false
terraform -chdir=infra/live/prod/us-east-1 validate
```

Use `-backend-config=/secure/path/*.s3.tfbackend` only after the remote state bootstrap is
complete. Do not commit populated `.tfvars` or `.tfbackend` files.

Operator steps for the organization root are in [live/org/README.md](live/org/README.md).

## Controlled tool and provider upgrades

Terraform is pinned in `.terraform-version` and in every root/module constraint. Provider selections
and registry checksums are committed in each environment lock file. Upgrade them only in a focused
pull request:

1. Review Terraform, AWS provider, TFLint, AWS TFLint rules, and Checkov release/security notes.
2. Update the pinned versions together with the workflow versions that run them.
3. Run `terraform init -backend=false -upgrade` in each environment root and commit the resulting
   lock-file changes; never hand-edit provider hashes.
4. Run formatting, validation, TFLint, repository policy tests, and Checkov locally and in CI.
5. Review a speculative plan for the intended account before applying. ALV production apply stays
   behind a protected GitHub Environment after account access exists.

Major upgrades and provider changes that alter state schemas require an explicit rollback note and
state backup confirmation before apply.
