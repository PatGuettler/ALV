import {
  EVENTS_CALENDAR_FEED_VERSION,
  publicEventFromCalendarRecord,
} from '../../src/scripts/events-calendar.js';

const GHL_EVENTS_URL = 'https://services.leadconnectorhq.com/calendars/events';
const GHL_BLOCKED_SLOTS_URL = 'https://services.leadconnectorhq.com/calendars/blocked-slots';
const GHL_API_VERSION = '2021-07-28';
const GHL_SYNC_USER_AGENT = 'alabama-veteran-events-sync/1.0';

export function publicEventsLookEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeCalendarRecords(recordLists) {
  const byId = new Map();
  for (const records of recordLists) {
    for (const record of Array.isArray(records) ? records : []) {
      const id = String(record?.id || '').trim();
      if (!id) continue;
      byId.set(id, record);
    }
  }
  return [...byId.values()];
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

async function fetchGhlCalendarCollection({
  endpoint,
  token,
  locationId,
  calendarId,
  startTime,
  endTime,
  fetchImpl = fetch,
  failureLabel,
  source,
  requireCalendarId = true,
} = {}) {
  if (!token) throw new Error('A GHL private integration token is required.');
  if (!locationId) throw new Error('A GHL location ID is required.');
  if (!calendarId) throw new Error('A GHL events calendar ID is required.');

  const url = new URL(endpoint);
  url.searchParams.set('locationId', locationId);
  url.searchParams.set('calendarId', calendarId);
  url.searchParams.set('startTime', String(startTime));
  url.searchParams.set('endTime', String(endTime));

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      Accept: 'application/json',
      'User-Agent': GHL_SYNC_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`${failureLabel} (${response.status}).`);
  }

  const payload = await response.json();
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events
    .filter((record) => {
      const recordCalendarId = String(record?.calendarId || '').trim();
      if (requireCalendarId) return recordCalendarId === calendarId;
      return !recordCalendarId || recordCalendarId === calendarId;
    })
    .map((record) => {
      const tagged = source ? { ...record, source } : { ...record };
      if (!String(tagged.calendarId || '').trim()) tagged.calendarId = calendarId;
      return tagged;
    });
}

export async function fetchGhlCalendarEvents(options = {}) {
  return fetchGhlCalendarCollection({
    ...options,
    endpoint: GHL_EVENTS_URL,
    failureLabel: 'GHL calendar events request failed',
  });
}

export async function fetchGhlBlockedSlots(options = {}) {
  return fetchGhlCalendarCollection({
    ...options,
    endpoint: GHL_BLOCKED_SLOTS_URL,
    failureLabel: 'GHL blocked slots request failed',
    source: 'blocked-slot',
    requireCalendarId: false,
  });
}

export async function fetchGhlPublicCalendarRecords(options = {}) {
  const [appointments, blockedSlots] = await Promise.all([
    fetchGhlCalendarEvents(options),
    fetchGhlBlockedSlots(options),
  ]);
  return mergeCalendarRecords([appointments, blockedSlots]);
}
