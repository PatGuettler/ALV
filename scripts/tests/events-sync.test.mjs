import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { ghl } from '../../src/config/ghl.js';
import {
  tokenFromSecretString,
  syncPublicEventsFeed,
} from '../../infra/functions/events-sync/sync.mjs';

const GHL_SYNC_IMPORT = "from '../../src/scripts/events-calendar.js'";
const LAMBDA_SYNC_IMPORT = "from '../../../scripts/lib/ghl-events-sync.mjs'";

test('reads a raw GHL token or a JSON secret payload', () => {
  assert.equal(tokenFromSecretString('  pit-test  \n'), 'pit-test');
  assert.equal(tokenFromSecretString('"pit-test"'), 'pit-test');
  assert.equal(tokenFromSecretString(JSON.stringify({ token: ' pit-json ' })), 'pit-json');
  assert.equal(tokenFromSecretString(''), '');
  assert.equal(tokenFromSecretString('{"token":""}'), '');
});

test('maps GHL records onto the public feed and skips an unchanged write', async () => {
  const records = [
    {
      id: 'keep-1',
      calendarId: ghl.eventsCalendarId,
      title: 'Community breakfast',
      startTime: '2026-09-12T14:00:00Z',
      endTime: '2026-09-12T16:00:00Z',
      appointmentStatus: 'confirmed',
    },
  ];
  const first = await syncPublicEventsFeed({
    now: Date.parse('2026-09-03T12:00:00Z'),
    token: 'pit-test',
    locationId: ghl.locationId,
    calendarId: ghl.eventsCalendarId,
    fetchRecords: async () => records,
  });
  assert.equal(first.unchanged, false);
  assert.equal(first.feed.events.length, 1);
  assert.equal(first.feed.events[0].title, 'Community breakfast');
  assert.equal(JSON.stringify(first.feed).includes('pit-test'), false);

  const second = await syncPublicEventsFeed({
    now: Date.parse('2026-09-03T12:01:00Z'),
    token: JSON.stringify({ token: 'pit-test' }),
    locationId: ghl.locationId,
    calendarId: ghl.eventsCalendarId,
    previousFeed: first.feed,
    fetchRecords: async () => records,
  });
  assert.equal(second.unchanged, true);
  assert.equal(second.feed.events[0].id, 'keep-1');
});

test('fails closed without a GHL token and keeps Lambda zip import rewrites stable', async () => {
  await assert.rejects(
    () =>
      syncPublicEventsFeed({
        token: '',
        locationId: ghl.locationId,
        calendarId: ghl.eventsCalendarId,
        fetchRecords: async () => {
          throw new Error('should not fetch');
        },
      }),
    /token is required/,
  );

  const ghlSync = await readFile(new URL('../lib/ghl-events-sync.mjs', import.meta.url), 'utf8');
  const lambdaSync = await readFile(
    new URL('../../infra/functions/events-sync/sync.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(ghlSync.includes(GHL_SYNC_IMPORT), true);
  assert.equal(lambdaSync.includes(LAMBDA_SYNC_IMPORT), true);
});
