import assert from 'node:assert/strict';
import test from 'node:test';

import { retreatLive, retreatPublic } from '../../src/config/retreat.js';

test('retreat apply and staff stay on for production, staging, and local builds', () => {
  assert.equal(Boolean(retreatPublic.apiUrl), true);
  assert.equal(retreatLive, ['production', 'staging', ''].includes(process.env.SITE_ENV || ''));
});
