import assert from 'node:assert/strict';
import test from 'node:test';

import { ghl } from '../../src/config/ghl.js';
import { buildPublicEventsFeed, fetchGhlCalendarEvents } from '../lib/ghl-events-sync.mjs';

test('maps only the AV Events Calendar and strips private GHL fields', () => {
  const feed = buildPublicEventsFeed(
    [
      {
        id: 'keep-1',
        calendarId: ghl.eventsCalendarId,
        title: 'Board breakfast',
        startTime: '2026-09-12T14:00:00Z',
        endTime: '2026-09-12T16:00:00Z',
        address: 'Birmingham, AL',
        notes: 'Veterans welcome',
        appointmentStatus: 'confirmed',
        contactId: 'ct-secret',
        assignedUserId: 'user-secret',
        email: 'vet@example.com',
      },
      {
        id: 'skip-other',
        calendarId: 'other-calendar',
        title: 'Staff only',
        startTime: '2026-09-12T14:00:00Z',
        endTime: '2026-09-12T16:00:00Z',
        appointmentStatus: 'confirmed',
      },
    ],
    { calendarId: ghl.eventsCalendarId, generatedAt: new Date('2026-09-03T12:00:00Z') },
  );

  assert.equal(feed.version, 1);
  assert.equal(feed.events.length, 1);
  assert.equal(feed.events[0].title, 'Board breakfast');
  assert.equal(JSON.stringify(feed).includes('ct-secret'), false);
  assert.equal(JSON.stringify(feed).includes('vet@example.com'), false);
});

test('fetchGhlCalendarEvents queries only the requested calendar and rejects HTTP errors', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ href: String(url), hasAuth: Boolean(options.headers.Authorization) });
    return {
      ok: true,
      json: async () => ({
        events: [
          { id: '1', calendarId: ghl.eventsCalendarId, title: 'Kept' },
          { id: '2', calendarId: 'nope', title: 'Dropped' },
        ],
      }),
    };
  };

  const events = await fetchGhlCalendarEvents({
    token: 'pit-test',
    locationId: ghl.locationId,
    calendarId: ghl.eventsCalendarId,
    startTime: 1,
    endTime: 2,
    fetchImpl,
  });

  const url = new URL(calls[0].href);
  assert.equal(url.searchParams.get('calendarId'), ghl.eventsCalendarId);
  assert.equal(url.searchParams.get('locationId'), ghl.locationId);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, '1');

  await assert.rejects(
    () =>
      fetchGhlCalendarEvents({
        token: 'pit-test',
        locationId: ghl.locationId,
        calendarId: ghl.eventsCalendarId,
        startTime: 1,
        endTime: 2,
        fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
      }),
    /failed \(401\)/,
  );
});
