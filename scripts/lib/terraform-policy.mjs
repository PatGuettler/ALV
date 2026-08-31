const sensitivePatterns = [
  {
    name: 'AWS access key',
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    name: 'private key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'public S3 ACL',
    pattern: /\bacl\s*=\s*"public-(?:read|read-write)"/i,
  },
  {
    name: 'wildcard IAM action',
    pattern: /\bAction\s*=\s*(?:"\*"|\[\s*"\*"\s*\])/i,
  },
  {
    name: 'wildcard IAM resource',
    pattern: /\bResource\s*=\s*(?:"\*"|\[\s*"\*"\s*\])/i,
  },
  {
    name: 'local Terraform backend',
    pattern: /backend\s+"local"/i,
  },
];

function hasFile(files, suffix) {
  return files.find(({ path }) => path.replaceAll('\\', '/').endsWith(suffix));
}

export function checkTerraformPolicy(files) {
  const failures = [];

  for (const file of files) {
    for (const rule of sensitivePatterns) {
      if (rule.pattern.test(file.source)) failures.push(`${file.path}: contains ${rule.name}.`);
    }
  }

  for (const environment of ['nonprod', 'prod']) {
    const root = `infra/live/${environment}/us-east-1/`;
    const provider = hasFile(files, `${root}providers.tf`);
    const backend = hasFile(files, `${root}backend.s3.tfbackend.example`);

    if (!provider) {
      failures.push(`${root}providers.tf is required.`);
    } else {
      if (!provider.source.includes('allowed_account_ids')) {
        failures.push(`${provider.path}: AWS provider must restrict allowed_account_ids.`);
      }
      if (!provider.source.includes('default_tags')) {
        failures.push(`${provider.path}: AWS provider must define default_tags.`);
      }
      if (!provider.source.includes('backend "s3"')) {
        failures.push(`${provider.path}: environment state must use the S3 backend.`);
      }
    }

    if (!backend) {
      failures.push(`${root}backend.s3.tfbackend.example is required.`);
    } else {
      if (!/\buse_lockfile\s*=\s*true/.test(backend.source)) {
        failures.push(`${backend.path}: S3 native use_lockfile must be enabled.`);
      }
      if (/\bdynamodb_table\s*=/.test(backend.source)) {
        failures.push(`${backend.path}: deprecated DynamoDB state locking is not permitted.`);
      }
    }
  }

  return failures;
}
