import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ghl } from '../src/config/ghl.js';
import {
  buildPublicEventsFeed,
  fetchGhlCalendarEvents,
  publicEventsLookEqual,
} from './lib/ghl-events-sync.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const feedPath = resolve(projectRoot, 'public/data/events-calendar.json');
const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN || '';
const locationId = process.env.GHL_LOCATION_ID || ghl.locationId;
const calendarId = process.env.GHL_EVENTS_CALENDAR_ID || ghl.eventsCalendarId;
const now = Date.now();
const startTime = now - 7 * 24 * 60 * 60 * 1000;
const endTime = now + 365 * 24 * 60 * 60 * 1000;

const records = await fetchGhlCalendarEvents({
  token,
  locationId,
  calendarId,
  startTime,
  endTime,
});
const feed = buildPublicEventsFeed(records, { calendarId, generatedAt: new Date(now) });

let previousEvents = [];
try {
  previousEvents = JSON.parse(await readFile(feedPath, 'utf8')).events || [];
} catch {
  previousEvents = [];
}

if (publicEventsLookEqual(previousEvents, feed.events)) {
  console.log(`Public events calendar is already current (${feed.events.length} events).`);
  process.exit(0);
}

await writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Wrote ${feed.events.length} public events from GHL calendar ${calendarId}.`);
