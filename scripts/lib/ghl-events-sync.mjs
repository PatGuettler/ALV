import {
  EVENTS_CALENDAR_FEED_VERSION,
  publicEventFromCalendarRecord,
} from '../../src/scripts/events-calendar.js';

const GHL_EVENTS_URL = 'https://services.leadconnectorhq.com/calendars/events';
const GHL_API_VERSION = '2021-07-28';

export function publicEventsLookEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildPublicEventsFeed(records, { calendarId, generatedAt = new Date() } = {}) {
  const events = (Array.isArray(records) ? records : [])
    .map((record) => publicEventFromCalendarRecord(record, { eventsCalendarId: calendarId }))
    .filter(Boolean)
    .sort(
      (left, right) =>
        new Date(left.startAt) - new Date(right.startAt) || left.id.localeCompare(right.id),
    );

  return {
    version: EVENTS_CALENDAR_FEED_VERSION,
    generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt),
    events,
  };
}

export async function fetchGhlCalendarEvents({
  token,
  locationId,
  calendarId,
  startTime,
  endTime,
  fetchImpl = fetch,
} = {}) {
  if (!token) throw new Error('A GHL private integration token is required.');
  if (!locationId) throw new Error('A GHL location ID is required.');
  if (!calendarId) throw new Error('A GHL events calendar ID is required.');

  const url = new URL(GHL_EVENTS_URL);
  url.searchParams.set('locationId', locationId);
  url.searchParams.set('calendarId', calendarId);
  url.searchParams.set('startTime', String(startTime));
  url.searchParams.set('endTime', String(endTime));

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      Accept: 'application/json',
      'User-Agent': 'alabama-veteran-events-sync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`GHL calendar events request failed (${response.status}).`);
  }

  const payload = await response.json();
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events.filter((record) => String(record?.calendarId || '') === calendarId);
}
