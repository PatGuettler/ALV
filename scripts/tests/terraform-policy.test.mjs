import assert from 'node:assert/strict';
import test from 'node:test';

import { checkTerraformPolicy } from '../lib/terraform-policy.mjs';

function compliantRoot(environment) {
  const root = `infra/live/${environment}/us-east-1/`;
  return [
    {
      path: `${root}providers.tf`,
      source: `
        terraform { backend "s3" {} }
        provider "aws" {
          allowed_account_ids = [var.aws_account_id]
          default_tags { tags = local.required_tags }
        }
      `,
    },
    {
      path: `${root}backend.s3.tfbackend.example`,
      source: 'use_lockfile = true',
    },
  ];
}

test('accepts isolated environment roots with native S3 locking', () => {
  const failures = checkTerraformPolicy([
    ...compliantRoot('org'),
    ...compliantRoot('nonprod'),
    ...compliantRoot('prod'),
  ]);
  assert.deepEqual(failures, []);
});

test('rejects a deliberate public bucket and wildcard IAM policy violation', () => {
  const files = [
    ...compliantRoot('org'),
    ...compliantRoot('nonprod'),
    ...compliantRoot('prod'),
    {
      path: 'infra/modules/unsafe/main.tf',
      source: `
        resource "aws_s3_bucket_acl" "unsafe" { acl = "public-read" }
        data "aws_iam_policy_document" "unsafe" {
          statement { Action = ["*"] Resource = "*" }
        }
      `,
    },
  ];
  const failures = checkTerraformPolicy(files);

  assert.equal(failures.length, 3);
  assert.match(failures.join('\n'), /public S3 ACL/);
  assert.match(failures.join('\n'), /wildcard IAM action/);
  assert.match(failures.join('\n'), /wildcard IAM resource/);
});

test('rejects missing account guards and deprecated state locking', () => {
  const files = [...compliantRoot('org'), ...compliantRoot('nonprod'), ...compliantRoot('prod')];
  files.find(({ path }) => path.includes('/prod/') && path.endsWith('providers.tf')).source =
    'terraform { backend "local" {} } provider "aws" {}';
  files.find(({ path }) => path.includes('/prod/') && path.endsWith('.example')).source =
    'dynamodb_table = "legacy-locks"';

  const failures = checkTerraformPolicy(files).join('\n');
  assert.match(failures, /local Terraform backend/);
  assert.match(failures, /allowed_account_ids/);
  assert.match(failures, /default_tags/);
  assert.match(failures, /S3 backend/);
  assert.match(failures, /use_lockfile/);
  assert.match(failures, /deprecated DynamoDB/);
});

test('rejects an AWS access key and a private key block', () => {
  const files = [
    ...compliantRoot('org'),
    ...compliantRoot('nonprod'),
    ...compliantRoot('prod'),
    {
      path: 'infra/modules/unsafe/secrets.tf',
      source: `
        # AKIAIOSFODNN7EXAMPLE is the AWS documentation example, not a live key.
        unused = "AKIAIOSFODNN7EXAMPLE"
        pem = <<-EOF
        -----BEGIN RSA PRIVATE KEY-----
        fake
        -----END RSA PRIVATE KEY-----
        EOF
      `,
    },
  ];
  const failures = checkTerraformPolicy(files).join('\n');
  assert.match(failures, /AWS access key/);
  assert.match(failures, /private key/);
});

test('rejects a missing environment providers file and backend example', () => {
  const files = [...compliantRoot('nonprod'), ...compliantRoot('prod')];
  const failures = checkTerraformPolicy(files).join('\n');
  assert.match(failures, /infra\/live\/org\/us-east-1\/providers.tf is required/);
  assert.match(failures, /infra\/live\/org\/us-east-1\/backend.s3.tfbackend.example is required/);
});
