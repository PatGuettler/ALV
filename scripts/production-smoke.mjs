import { collectProductionSmoke, evaluateProductionSmoke } from './lib/production-smoke.mjs';

const origin = process.env.PRODUCTION_URL;
if (!origin) {
  throw new Error('PRODUCTION_URL is required for the production smoke gate.');
}

const observations = await collectProductionSmoke(origin);
const failures = evaluateProductionSmoke(observations);
if (failures.length) {
  throw new Error(`Production smoke failed:\n${failures.join('\n')}`);
}
console.log(`Production smoke passed ${observations.routes.length} representative HTTPS routes.`);
