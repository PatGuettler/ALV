import assert from 'node:assert/strict';
import test from 'node:test';

import { ghl } from '../../src/config/ghl.js';
import {
  buildPublicEventsFeed,
  fetchGhlBlockedSlots,
  fetchGhlCalendarEvents,
  fetchGhlPublicCalendarRecords,
  normalizeGhlSecret,
} from '../lib/ghl-events-sync.mjs';

test('strips quotes and whitespace from GHL secrets', () => {
  assert.equal(normalizeGhlSecret('  pit-test  \n'), 'pit-test');
  assert.equal(normalizeGhlSecret('"pit-test"'), 'pit-test');
});

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

test('includes blocked-off time from the AV Events Calendar', () => {
  const feed = buildPublicEventsFeed(
    [
      {
        id: 'block-1',
        calendarId: ghl.eventsCalendarId,
        source: 'blocked-slot',
        title: 'Community breakfast',
        startTime: '2026-09-03T21:30:00Z',
        endTime: '2026-09-03T22:00:00Z',
        assignedUserId: 'user-secret',
      },
    ],
    { calendarId: ghl.eventsCalendarId, generatedAt: new Date('2026-09-03T12:00:00Z') },
  );

  assert.equal(feed.events.length, 1);
  assert.equal(feed.events[0].title, 'Community breakfast');
  assert.equal(JSON.stringify(feed).includes('user-secret'), false);
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
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Invalid token: access token is invalid' }),
        }),
      }),
    /failed \(401: Invalid token: access token is invalid\)/,
  );
});

test('fetchGhlPublicCalendarRecords merges appointments and blocked slots', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    calls.push(href);
    const blocked = href.includes('/blocked-slots');
    return {
      ok: true,
      json: async () => ({
        events: blocked
          ? [
              {
                id: 'block-1',
                title: 'Reserved',
                startTime: '2026-09-03T21:30:00Z',
                endTime: '2026-09-03T22:00:00Z',
              },
            ]
          : [{ id: 'appt-1', calendarId: ghl.eventsCalendarId, title: 'Kept' }],
      }),
    };
  };

  const records = await fetchGhlPublicCalendarRecords({
    token: 'pit-test',
    locationId: ghl.locationId,
    calendarId: ghl.eventsCalendarId,
    startTime: 1,
    endTime: 2,
    fetchImpl,
  });

  assert.equal(
    calls.some((href) => href.includes('/calendars/events')),
    true,
  );
  assert.equal(
    calls.some((href) => href.includes('/calendars/blocked-slots')),
    true,
  );
  assert.equal(records.length, 2);
  assert.equal(records.find((record) => record.id === 'block-1')?.source, 'blocked-slot');
  assert.equal(records.find((record) => record.id === 'block-1')?.calendarId, ghl.eventsCalendarId);

  const blockedOnly = await fetchGhlBlockedSlots({
    token: 'pit-test',
    locationId: ghl.locationId,
    calendarId: ghl.eventsCalendarId,
    startTime: 1,
    endTime: 2,
    fetchImpl,
  });
  assert.equal(blockedOnly[0].source, 'blocked-slot');
});
