import {
  buildPublicEventsFeed,
  fetchGhlPublicCalendarRecords,
  normalizeGhlSecret,
  publicEventsLookEqual,
} from '../../../scripts/lib/ghl-events-sync.mjs';

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export function tokenFromSecretString(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return normalizeGhlSecret(parsed.token || parsed.Token || '');
    }
  } catch {
    // Secret is the raw private integration token.
  }
  return normalizeGhlSecret(raw);
}

export async function syncPublicEventsFeed({
  now = Date.now(),
  token,
  locationId,
  calendarId,
  previousFeed,
  fetchRecords = fetchGhlPublicCalendarRecords,
} = {}) {
  const accessToken = tokenFromSecretString(token);
  if (!accessToken) throw new Error('A GHL private integration token is required.');
  const scopedLocationId = String(locationId || '').trim();
  const scopedCalendarId = String(calendarId || '').trim();
  if (!scopedLocationId) throw new Error('A GHL location ID is required.');
  if (!scopedCalendarId) throw new Error('A GHL events calendar ID is required.');

  const records = await fetchRecords({
    token: accessToken,
    locationId: scopedLocationId,
    calendarId: scopedCalendarId,
    startTime: now - LOOKBACK_MS,
    endTime: now + LOOKAHEAD_MS,
  });
  const feed = buildPublicEventsFeed(records, {
    calendarId: scopedCalendarId,
    generatedAt: new Date(now),
  });
  const unchanged = Boolean(
    previousFeed && publicEventsLookEqual(previousFeed.events, feed.events),
  );

  return {
    feed,
    unchanged,
    recordCount: Array.isArray(records) ? records.length : 0,
  };
}
