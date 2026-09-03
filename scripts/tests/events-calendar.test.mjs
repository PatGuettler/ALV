import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  buildMonthCells,
  eventsForMonth,
  eventsOnChicagoDate,
  normalizePublicEvent,
  publicEventFromCalendarRecord,
} from '../../src/scripts/events-calendar.js';
import { ghl } from '../../src/config/ghl.js';

const event = (overrides = {}) => ({
  id: 'event-1',
  title: 'War on the Greens',
  startAt: '2026-10-19T12:30:00Z',
  endAt: '2026-10-19T16:30:00Z',
  venue: 'Inverness Country Club',
  summary: 'Annual golf fundraiser',
  url: 'https://alabamaveteran.org/events/war-on-the-greens',
  category: 'fundraiser',
  status: 'published',
  ...overrides,
});

test('normalizes published public events and drops booking-widget links', () => {
  assert.equal(normalizePublicEvent(event())?.title, 'War on the Greens');
  assert.equal(normalizePublicEvent(event({ status: 'draft' })), null);
  assert.equal(
    normalizePublicEvent(
      event({ url: 'https://app.alabamaveteran.org/widget/booking/zfYlU1tekAs9O3E2xGT8' }),
    )?.url,
    '',
  );
  assert.equal(normalizePublicEvent(event({ url: 'http://insecure.example/x' }))?.url, '');
});

test('maps only AV Events Calendar records and ignores other calendars', () => {
  const record = {
    id: 'ghl-1',
    calendarId: ghl.eventsCalendarId,
    title: 'Community breakfast',
    startTime: '2026-09-12T14:00:00Z',
    endTime: '2026-09-12T16:00:00Z',
    publicUrl: 'https://alabamaveteran.org/events/',
    appointmentStatus: 'confirmed',
  };
  assert.equal(
    publicEventFromCalendarRecord(record, { eventsCalendarId: ghl.eventsCalendarId })?.title,
    'Community breakfast',
  );
  assert.equal(publicEventFromCalendarRecord(record, { eventsCalendarId: 'other-calendar' }), null);
});

test('groups events onto America/Chicago month days', () => {
  const october = eventsForMonth([event()], 2026, 9);
  assert.equal(october.length, 1);
  assert.equal(eventsOnChicagoDate([event()], 2026, 9, 19).length, 1);
  assert.equal(eventsOnChicagoDate([event()], 2026, 9, 18).length, 0);
});

test('builds a Sunday-start month grid with event markers', () => {
  const cells = buildMonthCells(2026, 8, new Set(['2026-09-05']), { todayKey: '2026-09-02' });
  assert.equal(cells.length, 42);
  const fifth = cells.find((cell) => cell.day === 5 && cell.inMonth);
  assert.equal(fifth?.hasEvent, true);
  const today = cells.find((cell) => cell.day === 2 && cell.inMonth);
  assert.equal(today?.isToday, true);
});

test('the shipped events feed only contains normalized public records', async () => {
  const feed = JSON.parse(
    await readFile(new URL('../../public/data/events-calendar.json', import.meta.url), 'utf8'),
  );
  assert.equal(feed.version, 1);
  assert.equal(Array.isArray(feed.events), true);
  for (const record of feed.events) {
    const event = normalizePublicEvent(record);
    assert.equal(event?.id, record.id);
    assert.equal(String(JSON.stringify(event)).includes('/widget/booking'), false);
  }
});
