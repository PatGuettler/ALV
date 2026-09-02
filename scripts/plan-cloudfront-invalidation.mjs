import { readFile } from 'node:fs/promises';
import { planCloudFrontInvalidation } from './lib/cloudfront-invalidation.mjs';

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error('Usage: node scripts/plan-cloudfront-invalidation.mjs <asset-manifest.json>');
}

const plan = planCloudFrontInvalidation(JSON.parse(await readFile(manifestPath, 'utf8')));
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
