import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  EVENTS_CALENDAR_LIVE_FEED_URL,
  EVENTS_CALENDAR_REFRESH_MS,
  EVENTS_CALENDAR_STAGING_FEED_URL,
  buildMonthCells,
  eventsForMonth,
  eventsFromFeedPayload,
  eventsGroupedByChicagoMonth,
  eventsOnChicagoDate,
  mergePublicEvents,
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

test('keeps invitational titles and pulls a public photo URL out of GHL notes', () => {
  const mapped = publicEventFromCalendarRecord(
    {
      id: 'ghl-pet',
      calendarId: ghl.eventsCalendarId,
      title: 'Join us Saturday morning for Vet to Pet Day',
      startTime: '2026-09-12T14:00:00Z',
      endTime: '2026-09-12T16:00:00Z',
      address: 'Birmingham Animal Shelter',
      notes:
        'Meet adoptable pets and fellow veterans. https://cdn.example.com/pets.webp More dogs arrive at 10.',
      appointmentStatus: 'confirmed',
    },
    { eventsCalendarId: ghl.eventsCalendarId },
  );
  assert.equal(mapped?.title, 'Join us Saturday morning for Vet to Pet Day');
  assert.equal(mapped?.imageUrl, 'https://cdn.example.com/pets.webp');
  assert.equal(mapped?.summary.includes('https://'), false);
  assert.equal(mapped?.venue, 'Birmingham Animal Shelter');
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

test('maps AV Events Calendar blocked-off time onto the public feed', () => {
  const blocked = {
    id: 'block-1',
    calendarId: ghl.eventsCalendarId,
    source: 'blocked-slot',
    title: '',
    startTime: '2026-09-03T21:30:00Z',
    endTime: '2026-09-03T22:00:00Z',
    notes: 'Board breakfast at 4:30',
  };
  assert.equal(
    publicEventFromCalendarRecord(blocked, { eventsCalendarId: ghl.eventsCalendarId })?.title,
    'Board breakfast at 4:30',
  );
  assert.equal(
    publicEventFromCalendarRecord(
      { ...blocked, notes: '', description: '' },
      { eventsCalendarId: ghl.eventsCalendarId },
    )?.title,
    'Alabama Veteran event',
  );
});

test('groups events onto America/Chicago month days', () => {
  const october = eventsForMonth([event()], 2026, 9);
  assert.equal(october.length, 1);
  assert.equal(eventsOnChicagoDate([event()], 2026, 9, 19).length, 1);
  assert.equal(eventsOnChicagoDate([event()], 2026, 9, 18).length, 0);
});

test('groups public events onto Chicago months for the happening strip', () => {
  const groups = eventsGroupedByChicagoMonth([
    event(),
    event({
      id: 'event-2',
      title: 'Motors on Main',
      startAt: '2026-09-12T17:00:00Z',
      endAt: '2026-09-12T21:00:00Z',
    }),
  ]);
  assert.equal(groups[0]?.label, 'September 2026');
  assert.equal(groups[0]?.events[0]?.title, 'Motors on Main');
  assert.equal(groups[1]?.label, 'October 2026');
});

test('builds a Sunday-start month grid with event markers', () => {
  const cells = buildMonthCells(2026, 8, new Set(['2026-09-05']), { todayKey: '2026-09-02' });
  assert.equal(cells.length, 42);
  const fifth = cells.find((cell) => cell.day === 5 && cell.inMonth);
  assert.equal(fifth?.hasEvent, true);
  const today = cells.find((cell) => cell.day === 2 && cell.inMonth);
  assert.equal(today?.isToday, true);
});

test('reads the live GitHub feed payload used for frequent refresh', async () => {
  assert.equal(EVENTS_CALENDAR_REFRESH_MS, 30_000);
  assert.match(EVENTS_CALENDAR_LIVE_FEED_URL, /raw\.githubusercontent\.com\/PatGuettler\/ALV/);
  assert.match(EVENTS_CALENDAR_STAGING_FEED_URL, /cloudfront\.net\/data\/events-calendar\.json/);
  const calendar = await readFile(
    new URL('../../src/components/events/EventsCalendar.astro', import.meta.url),
    'utf8',
  );
  assert.match(calendar, /PUBLIC_EVENTS_FEED_URL/);
  const events = eventsFromFeedPayload({
    version: 1,
    events: [event({ title: 'Join us Saturday morning for Vet to Pet Day' })],
  });
  assert.equal(events?.[0]?.title, 'Join us Saturday morning for Vet to Pet Day');
  assert.equal(eventsFromFeedPayload({ version: 2, events: [event()] }), null);
});

test('events page ships the Drop fundraising layout, not a calendar-only shell', async () => {
  const page = await readFile(new URL('../../src/pages/events.astro', import.meta.url), 'utf8');
  assert.match(page, /EventsFundraising/);
  assert.match(page, /EventsMonthStrip/);
  assert.match(page, /EventsSubscribe/);
  assert.match(page, /WogModals/);
  assert.doesNotMatch(page, /CalendarStatus/);
  const fundraising = await readFile(
    new URL('../../src/components/events/EventsFundraising.astro', import.meta.url),
    'utf8',
  );
  assert.match(fundraising, /Make an/);
  assert.match(fundraising, /War on the Greens/);
  assert.match(fundraising, /Salute to Service/);
  assert.match(fundraising, /Date Coming Soon/);

  const monthStrip = await readFile(
    new URL('../../src/components/events/EventsMonthStrip.astro', import.meta.url),
    'utf8',
  );
  assert.match(monthStrip, /What's Happening/);
});

test('merges the published events catalog with live public records', () => {
  const merged = mergePublicEvents(
    [
      event({
        id: 'published-war-on-the-greens-birmingham',
        title: 'War on the Greens – Birmingham',
        startAt: '2026-10-19T12:30:00.000Z',
        endAt: '2026-10-19T20:30:00.000Z',
      }),
    ],
    [
      event({
        id: 'published-war-on-the-greens-birmingham',
        title: 'War on the Greens – Birmingham',
        startAt: '2026-10-19T12:30:00.000Z',
        endAt: '2026-10-19T20:30:00.000Z',
      }),
      event({
        id: 'live-pet-day',
        title: 'Vet to Pet Day',
        startAt: '2026-09-12T14:00:00Z',
        endAt: '2026-09-12T16:00:00Z',
      }),
    ],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'Vet to Pet Day');
  assert.equal(merged[1].id, 'published-war-on-the-greens-birmingham');
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
