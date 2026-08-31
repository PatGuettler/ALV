# Terraform infrastructure

This directory is the implementation root for Alabama Veteran AWS resources. GitHub Pages remains
public visual staging; these roots are for isolated AWS nonproduction and production accounts.

## Boundaries

- `live/nonprod/us-east-1` and `live/prod/us-east-1` use separate AWS accounts, state keys, and input
  files. Terraform workspaces are not an environment boundary.
- Every provider is restricted with `allowed_account_ids` so an incorrect credential fails before
  resource changes.
- Remote state configuration is supplied at initialization time from an uncommitted backend file.
  Backend buckets and apply roles are created only by the dedicated bootstrap backlog items.
- No AWS resource is present in this scaffold. Resource modules are implemented and reviewed by
  their focused backlog issues after account, domain, retention, and ownership inputs are approved.

## Naming and tags

Resource names use the lowercase prefix `avl-<environment>`. Modules must accept that prefix rather
than inventing independent names. Every supported resource inherits these provider default tags:

- `Project=alabama-veteran`
- `Environment=nonprod|prod`
- `ManagedBy=terraform`
- `Owner=<approved owner>`
- `CostCenter=<approved cost center>`
- `DataClassification=public|internal|confidential|restricted`

Additional module tags may add context but may not replace the required keys. Never put secrets,
email addresses used as credentials, or private customer data in variables, tfvars, outputs, state
keys, or tags.

## Local validation

Copy the example tfvars/backend files outside the repository, replace placeholders, authenticate to
the intended account with IAM Identity Center, and then run:

```bash
terraform -chdir=infra/live/nonprod/us-east-1 init -backend=false
terraform -chdir=infra/live/nonprod/us-east-1 validate

terraform -chdir=infra/live/prod/us-east-1 init -backend=false
terraform -chdir=infra/live/prod/us-east-1 validate
```

Use `-backend-config=/secure/path/nonprod.s3.tfbackend` only after the remote state bootstrap is
complete. Do not commit populated `.tfvars` or `.tfbackend` files.
