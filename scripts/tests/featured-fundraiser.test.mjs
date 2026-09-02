import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  PUBLIC_FUNDRAISER_FIELDS,
  buildFeaturedFundraiserFeed,
  formatFundraiserDate,
  normalizeFundraiserEvent,
  publicFundraiserFromCalendarRecord,
  selectFeaturedFundraiser,
} from '../../src/scripts/featured-fundraiser.js';
import { ghl } from '../../src/config/ghl.js';

const now = new Date('2026-09-02T15:00:00Z');
const event = (overrides = {}) => ({
  id: 'fundraiser-1',
  title: 'War on the Greens',
  startAt: '2026-10-19T12:30:00Z',
  endAt: '2026-10-19T16:30:00Z',
  venue: 'Inverness Country Club, Birmingham, AL',
  summary: 'Annual fundraiser',
  url: 'https://alabamaveteran.org/events/war-on-the-greens',
  category: 'fundraiser',
  status: 'published',
  updatedAt: '2026-09-02T14:00:00Z',
  ...overrides,
});

test('normalizes only public fundraiser records with safe links and dates', () => {
  assert.equal(normalizeFundraiserEvent(event())?.id, 'fundraiser-1');
  assert.equal(normalizeFundraiserEvent(event({ category: 'retreat' })), null);
  assert.equal(normalizeFundraiserEvent(event({ status: 'cancelled' })), null);
  assert.equal(normalizeFundraiserEvent(event({ url: 'javascript:alert(1)' })), null);
  assert.equal(normalizeFundraiserEvent(event({ endAt: '2026-10-19T11:30:00Z' })), null);
});

test('selects the earliest future fundraiser and deterministically breaks ties', () => {
  const selected = selectFeaturedFundraiser(
    {
      version: 1,
      generatedAt: '2026-09-02T14:30:00Z',
      events: [
        event({ id: 'later', startAt: '2026-12-01T14:00:00Z', endAt: '2026-12-01T16:00:00Z' }),
        event({ id: 'z-tie' }),
        event({ id: 'a-tie' }),
      ],
    },
    { now },
  );
  assert.equal(selected?.id, 'a-tie');
});

test('fails closed for stale feeds, past events, private records, and unsupported versions', () => {
  const base = { version: 1, generatedAt: '2026-09-02T14:30:00Z', events: [event()] };
  assert.equal(selectFeaturedFundraiser({ ...base, version: 2 }, { now }), null);
  assert.equal(
    selectFeaturedFundraiser({ ...base, generatedAt: '2026-09-01T00:00:00Z' }, { now }),
    null,
  );
  assert.equal(
    selectFeaturedFundraiser(
      {
        ...base,
        events: [event({ startAt: '2026-08-01T12:00:00Z', endAt: '2026-08-01T13:00:00Z' })],
      },
      { now },
    ),
    null,
  );
  assert.equal(
    selectFeaturedFundraiser({ ...base, events: [event({ status: 'draft' })] }, { now }),
    null,
  );
});

test('formats announcement dates in the Alabama time zone', () => {
  assert.match(formatFundraiserDate('2026-10-19T12:30:00Z'), /Oct 19/);
  assert.match(formatFundraiserDate('2026-10-19T12:30:00Z'), /7:30 AM CDT/);
});

test('drops attendee and contact fields from representative GHL calendar records', () => {
  const mapped = publicFundraiserFromCalendarRecord(
    {
      id: 'ghl-1',
      calendarId: 'cal-fundraiser',
      title: 'War on the Greens',
      startTime: '2026-10-19T12:30:00Z',
      endTime: '2026-10-19T16:30:00Z',
      address: 'Inverness Country Club',
      notes: 'Annual golf fundraiser',
      publicUrl: 'https://alabamaveteran.org/events/war-on-the-greens',
      appointmentStatus: 'confirmed',
      dateUpdated: '2026-09-02T14:00:00Z',
      contactIds: ['ct-secret'],
      assignedUserId: 'user-staff',
      attendees: [{ email: 'vet@example.com', phone: '2055550100', name: 'Pat' }],
    },
    { fundraiserCalendarIds: ['cal-fundraiser'] },
  );
  assert.equal(mapped?.id, 'ghl-1');
  assert.deepEqual(Object.keys(mapped).sort(), [...PUBLIC_FUNDRAISER_FIELDS].sort());
  assert.equal(JSON.stringify(mapped).includes('vet@example.com'), false);
  assert.equal(JSON.stringify(mapped).includes('ct-secret'), false);
});

test('fails closed until fundraiser calendar IDs are configured and ignores other calendars', () => {
  const record = {
    id: 'ghl-1',
    calendarId: 'cal-fundraiser',
    title: 'War on the Greens',
    startTime: '2026-10-19T12:30:00Z',
    endTime: '2026-10-19T16:30:00Z',
    publicUrl: 'https://alabamaveteran.org/events/war-on-the-greens',
    appointmentStatus: 'confirmed',
    dateUpdated: '2026-09-02T14:00:00Z',
  };
  assert.deepEqual(ghl.fundraiserCalendarIds, []);
  assert.equal(publicFundraiserFromCalendarRecord(record, { fundraiserCalendarIds: [] }), null);
  assert.equal(
    publicFundraiserFromCalendarRecord(record, { fundraiserCalendarIds: ['cal-retreat'] }),
    null,
  );
  assert.equal(
    publicFundraiserFromCalendarRecord(
      { ...record, appointmentStatus: 'cancelled' },
      { fundraiserCalendarIds: ['cal-fundraiser'] },
    ),
    null,
  );
});

test('the shipped public feed stays empty until a live fundraiser calendar is connected', async () => {
  const feed = JSON.parse(
    await readFile(new URL('../../public/data/featured-fundraiser.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(feed.events, []);
  assert.equal(selectFeaturedFundraiser(feed, { now }), null);
});

test('buildFeaturedFundraiserFeed keeps only normalized public events', () => {
  const feed = buildFeaturedFundraiserFeed([event(), event({ category: 'retreat' })], {
    generatedAt: now,
  });
  assert.equal(feed.version, 1);
  assert.equal(feed.events.length, 1);
  assert.equal(selectFeaturedFundraiser(feed, { now })?.id, 'fundraiser-1');
});
