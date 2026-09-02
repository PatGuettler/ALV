export const FEATURED_FUNDRAISER_FEED_VERSION = 1;
export const FEATURED_FUNDRAISER_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const PUBLIC_FUNDRAISER_FIELDS = [
  'id',
  'title',
  'startAt',
  'endAt',
  'venue',
  'summary',
  'url',
  'category',
  'status',
  'updatedAt',
];

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safePublicUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeFundraiserEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || '').trim();
  const title = String(value.title || '').trim();
  const startAt = validDate(value.startAt);
  const endAt = validDate(value.endAt);
  const updatedAt = validDate(value.updatedAt);
  const url = safePublicUrl(value.url);
  if (
    !id ||
    id.length > 120 ||
    !title ||
    title.length > 180 ||
    value.category !== 'fundraiser' ||
    value.status !== 'published' ||
    !startAt ||
    !endAt ||
    endAt < startAt ||
    !updatedAt ||
    !url
  ) {
    return null;
  }

  return {
    id,
    title,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    venue: String(value.venue || '')
      .trim()
      .slice(0, 160),
    summary: String(value.summary || '')
      .trim()
      .slice(0, 240),
    url,
    category: 'fundraiser',
    status: 'published',
    updatedAt: updatedAt.toISOString(),
  };
}

export function publicFundraiserFromCalendarRecord(record, { fundraiserCalendarIds = [] } = {}) {
  if (!record || typeof record !== 'object') return null;
  if (!Array.isArray(fundraiserCalendarIds) || fundraiserCalendarIds.length === 0) return null;
  const calendarId = String(record.calendarId || '').trim();
  if (!fundraiserCalendarIds.includes(calendarId)) return null;
  const status = String(record.appointmentStatus || record.status || '').toLowerCase();
  if (status && status !== 'confirmed' && status !== 'published' && status !== 'scheduled') {
    return null;
  }
  return normalizeFundraiserEvent({
    id: record.id,
    title: record.title,
    startAt: record.startTime || record.startAt,
    endAt: record.endTime || record.endAt,
    venue: record.address || record.location || record.venue,
    summary: record.notes || record.summary,
    url: record.publicUrl || record.url,
    category: 'fundraiser',
    status: 'published',
    updatedAt: record.dateUpdated || record.updatedAt,
  });
}

export function buildFeaturedFundraiserFeed(events, { generatedAt = new Date() } = {}) {
  return {
    version: FEATURED_FUNDRAISER_FEED_VERSION,
    generatedAt: validDate(generatedAt)?.toISOString() || '',
    events: (Array.isArray(events) ? events : []).map(normalizeFundraiserEvent).filter(Boolean),
  };
}

export function selectFeaturedFundraiser(
  feed,
  { now = new Date(), maxAgeMs = FEATURED_FUNDRAISER_MAX_AGE_MS } = {},
) {
  if (!feed || feed.version !== FEATURED_FUNDRAISER_FEED_VERSION || !Array.isArray(feed.events)) {
    return null;
  }
  const generatedAt = validDate(feed.generatedAt);
  const clock = validDate(now);
  if (!generatedAt || !clock) return null;
  const age = clock.getTime() - generatedAt.getTime();
  if (age < -5 * 60 * 1000 || age > maxAgeMs) return null;

  return (
    feed.events
      .map(normalizeFundraiserEvent)
      .filter((event) => event && new Date(event.startAt) > clock)
      .sort(
        (left, right) =>
          new Date(left.startAt) - new Date(right.startAt) || left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

export function formatFundraiserDate(value) {
  const date = validDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function fillBanner(root, event) {
  const title = root.querySelector('[data-featured-title]');
  const date = root.querySelector('[data-featured-date]');
  const venue = root.querySelector('[data-featured-venue]');
  const link = root.querySelector('[data-featured-link]');
  if (
    !(title instanceof HTMLElement) ||
    !(date instanceof HTMLElement) ||
    !(venue instanceof HTMLElement) ||
    !(link instanceof HTMLAnchorElement)
  ) {
    return;
  }
  title.textContent = event.title;
  date.textContent = formatFundraiserDate(event.startAt);
  venue.textContent = event.venue;
  venue.hidden = !event.venue;
  link.href = event.url;
  root.hidden = false;
}

async function loadFeaturedFundraiser(root) {
  const feedUrl = root.dataset.feedUrl;
  if (!feedUrl) return;
  const abortController = new AbortController();
  const timeout = window.setTimeout(() => abortController.abort(), 5_000);
  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: 'application/json' },
      signal: abortController.signal,
    });
    if (!response.ok) return;
    const event = selectFeaturedFundraiser(await response.json());
    if (!event) return;
    fillBanner(root, event);
  } catch {
    // A missing, stale, or unavailable feed intentionally leaves the banner hidden.
  } finally {
    window.clearTimeout(timeout);
  }
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-featured-fundraiser]');
  if (root instanceof HTMLElement) loadFeaturedFundraiser(root);
}
