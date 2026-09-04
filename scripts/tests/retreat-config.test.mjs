import assert from 'node:assert/strict';
import test from 'node:test';

import { retreatLive, retreatPublic } from '../../src/config/retreat.js';

test('retreat apply and staff stay off unless SITE_ENV is production', () => {
  assert.equal(Boolean(retreatPublic.apiUrl), true);
  assert.equal(retreatLive, process.env.SITE_ENV === 'production');
});
