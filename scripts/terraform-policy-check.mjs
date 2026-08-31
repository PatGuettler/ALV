import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { checkTerraformPolicy } from './lib/terraform-policy.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const infraRoot = resolve(projectRoot, 'infra');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.terraform') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.name.endsWith('.tf') || entry.name.endsWith('.example')) files.push(path);
  }
  return files;
}

const files = await Promise.all(
  (await filesUnder(infraRoot)).map(async (path) => ({
    path: relative(projectRoot, path),
    source: await readFile(path, 'utf8'),
  })),
);
const failures = checkTerraformPolicy(files);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Terraform policy checks passed ${files.length} configuration and example files.`);
