export const EVENTS_CALENDAR_FEED_VERSION = 1;
export const EVENTS_CALENDAR_LIVE_FEED_URL =
  'https://raw.githubusercontent.com/PatGuettler/ALV/main/public/data/events-calendar.json';
export const EVENTS_CALENDAR_STAGING_FEED_URL =
  'https://d2liq44qankj57.cloudfront.net/data/events-calendar.json';
export const EVENTS_CALENDAR_REFRESH_MS = 30_000;
export const PUBLIC_EVENT_CATEGORIES = ['event', 'community', 'fundraiser', 'program'];
export const PUBLIC_EVENT_FIELDS = [
  'id',
  'title',
  'startAt',
  'endAt',
  'venue',
  'summary',
  'url',
  'imageUrl',
  'category',
  'status',
];

const EVENT_IMAGE_IN_TEXT =
  /https:\/\/[^\s<>"']+\.(?:jpe?g|png|webp|gif)(?:\?[^\s<>"']*)?|https:\/\/(?:assets\.cdn\.)?filesafe\.space\/[^\s<>"']+/gi;

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safePublicUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return '';
    if (/\/widget\/bookings?\//i.test(url.pathname)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function safeEventImageUrl(value) {
  const href = safePublicUrl(value);
  if (!href) return '';
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(href)) return href;
  if (/(?:assets\.cdn\.)?filesafe\.space\//i.test(href)) return href;
  return '';
}

export function extractEventImage(record) {
  if (!record || typeof record !== 'object') return { imageUrl: '', summary: '' };
  const explicit = safeEventImageUrl(
    record.imageUrl || record.photoUrl || record.image || record.photo,
  );
  const notes = String(record.notes || record.summary || record.description || '');
  const match = notes.match(EVENT_IMAGE_IN_TEXT)?.[0] || '';
  const fromNotes = safeEventImageUrl(match);
  return {
    imageUrl: explicit || fromNotes,
    summary: fromNotes ? notes.replace(fromNotes, '').replace(/\s+/g, ' ').trim() : notes.trim(),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function chicagoParts(value) {
  const date = validDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month') - 1, day: read('day') };
}

function chicagoDateKey(value) {
  const parts = chicagoParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function normalizePublicEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || '').trim();
  const title = String(value.title || '').trim();
  const startAt = validDate(value.startAt);
  const endAt = validDate(value.endAt);
  const category = String(value.category || 'event').trim();
  if (
    !id ||
    id.length > 120 ||
    !title ||
    title.length > 180 ||
    !PUBLIC_EVENT_CATEGORIES.includes(category) ||
    value.status !== 'published' ||
    !startAt ||
    !endAt ||
    endAt < startAt
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
      .slice(0, 400),
    url: safePublicUrl(value.url),
    imageUrl: safeEventImageUrl(value.imageUrl),
    category,
    status: 'published',
  };
}

const PUBLISHABLE_STATUSES = new Set(['confirmed', 'published', 'scheduled', 'blocked', 'new']);

export function isBlockedCalendarRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const source = String(record.source || record.eventType || record.type || '').toLowerCase();
  const status = String(record.appointmentStatus || record.status || '').toLowerCase();
  return source.includes('block') || status === 'blocked';
}

export function publicEventFromCalendarRecord(record, { eventsCalendarId = '' } = {}) {
  if (!record || typeof record !== 'object' || !eventsCalendarId) return null;
  if (String(record.calendarId || '').trim() !== eventsCalendarId) return null;
  const status = String(record.appointmentStatus || record.status || '').toLowerCase();
  const blocked = isBlockedCalendarRecord(record);
  if (status && !PUBLISHABLE_STATUSES.has(status)) return null;
  const extracted = extractEventImage(record);
  const title =
    String(record.title || '').trim() ||
    (blocked ? extracted.summary || 'Alabama Veteran event' : '');
  return normalizePublicEvent({
    id: record.id,
    title,
    startAt: record.startTime || record.startAt,
    endAt: record.endTime || record.endAt,
    venue: record.address || record.location || record.venue,
    summary: extracted.summary,
    url: record.publicUrl || record.url,
    imageUrl: extracted.imageUrl,
    category: record.category || 'event',
    status: 'published',
  });
}

export function mergePublicEvents(...lists) {
  const byId = new Map();
  const byKey = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const value of list) {
      const event = normalizePublicEvent(value);
      if (!event) continue;
      const key = `${chicagoDateKey(event.startAt)}|${event.title.toLowerCase()}`;
      if (byId.has(event.id) || byKey.has(key)) continue;
      byId.set(event.id, event);
      byKey.set(key, event);
    }
  }
  return [...byId.values()].sort(
    (left, right) => left.startAt.localeCompare(right.startAt) || left.id.localeCompare(right.id),
  );
}

export function eventsFromFeedPayload(feed) {
  if (feed?.version !== EVENTS_CALENDAR_FEED_VERSION || !Array.isArray(feed.events)) return null;
  return feed.events.map(normalizePublicEvent).filter(Boolean);
}

export function eventsForMonth(events, year, month) {
  return (Array.isArray(events) ? events : [])
    .map(normalizePublicEvent)
    .filter((event) => {
      if (!event) return false;
      const start = chicagoParts(event.startAt);
      const end = chicagoParts(event.endAt);
      if (!start || !end) return false;
      const view = year * 12 + month;
      return start.year * 12 + start.month <= view && end.year * 12 + end.month >= view;
    })
    .sort(
      (left, right) =>
        new Date(left.startAt) - new Date(right.startAt) || left.id.localeCompare(right.id),
    );
}

export function eventsOnChicagoDate(events, year, month, day) {
  const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return eventsForMonth(events, year, month).filter(
    (event) => chicagoDateKey(event.startAt) === key,
  );
}

export function eventsGroupedByChicagoMonth(events) {
  const groups = new Map();
  for (const event of [...events].sort((left, right) =>
    left.startAt.localeCompare(right.startAt),
  )) {
    const parts = chicagoParts(event.startAt);
    if (!parts) continue;
    const key = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}`;
    if (!groups.has(key)) {
      groups.set(key, {
        year: parts.year,
        month: parts.month,
        label: monthLabel(parts.year, parts.month),
        events: [],
      });
    }
    groups.get(key).events.push(event);
  }
  return [...groups.values()];
}

export function upcomingPublicEvents(events, limit = 4) {
  const now = Date.now();
  return [...events]
    .filter((event) => {
      const end = validDate(event.endAt);
      return end && end.getTime() >= now;
    })
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
    .slice(0, limit);
}

export function eventCategoryBadge(category) {
  if (category === 'fundraiser') return { className: 'bg-a', label: 'Fundraiser' };
  if (category === 'program') return { className: 'bg-r', label: 'Program' };
  if (category === 'community') return { className: 'bg-c', label: 'Community' };
  return { className: 'bg-c', label: 'Event' };
}

export function formatEventDate(value) {
  const date = validDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function monthLabel(year, month) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
}

export function buildMonthCells(year, month, eventDates, { todayKey } = {}) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const day = index - startOffset + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const key = inMonth
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : '';
    cells.push({
      key: key || `pad-${index}`,
      day: inMonth ? day : '',
      inMonth,
      hasEvent: Boolean(key && eventDates.has(key)),
      isToday: Boolean(key && key === todayKey),
    });
  }
  return cells;
}

function todayChicagoKey() {
  return chicagoDateKey(new Date());
}

function renderDetail(root, events, heading) {
  if (!events.length) {
    root.innerHTML = `<div class="evp-detail-empty"><p>${heading}</p></div>`;
    return;
  }
  root.innerHTML = events
    .map((event) => {
      const link = event.url
        ? `<a class="evp-detail-link btn-r" href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">Event details</a>`
        : '';
      const photo = event.imageUrl
        ? `<div class="evp-detail-photo"><img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.title)}" width="640" height="400" loading="lazy" /></div>`
        : '';
      return `<article class="evp-detail-event">
        ${photo}
        <div class="evp-detail-date">${escapeHtml(formatEventDate(event.startAt))}</div>
        <h3 class="evp-detail-title">${escapeHtml(event.title)}</h3>
        ${event.venue ? `<p class="evp-detail-loc">${escapeHtml(event.venue)}</p>` : ''}
        ${event.summary ? `<p class="evp-detail-desc">${escapeHtml(event.summary)}</p>` : ''}
        ${link}
      </article>`;
    })
    .join('');
}

function jumpCalendarToMonth(calendarRoot, state, year, month) {
  state.year = year;
  state.month = month;
  state.selectedKey = '';
  paintCalendar(calendarRoot, state);
  document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function paintMonthStrip(calendarRoot, state) {
  const strip = document.querySelector('[data-month-strip]');
  if (!(strip instanceof HTMLElement)) return;
  const groups = eventsGroupedByChicagoMonth(state.events);
  if (!groups.length) {
    strip.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'evp-month-strip-empty';
    empty.textContent = 'Public events will appear here as they are published.';
    strip.append(empty);
    return;
  }
  strip.replaceChildren(
    ...groups.map((group) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'evp-month-card';
      card.setAttribute('aria-label', `${group.label} events`);
      card.dataset.monthYear = String(group.year);
      card.dataset.monthIndex = String(group.month);
      const heading = document.createElement('div');
      heading.className = 'evp-month-card-month';
      heading.textContent = group.label;
      const list = document.createElement('ul');
      list.className = 'evp-month-card-events';
      for (const event of group.events.slice(0, 3)) {
        const item = document.createElement('li');
        item.textContent = event.title;
        list.append(item);
      }
      card.append(heading, list);
      return card;
    }),
  );
}

function paintHomeEvents(root, events) {
  const list = root.querySelector('[data-home-event-list]');
  if (!(list instanceof HTMLElement)) return;
  const upcoming = upcomingPublicEvents(events);
  if (!upcoming.length) {
    list.innerHTML =
      '<p class="ev-empty">Public events will appear here as they are published.</p>';
    return;
  }
  list.replaceChildren(
    ...upcoming.map((event) => {
      const row = document.createElement('a');
      row.className = 'ev-row';
      row.href = `${root.dataset.eventsPath || '/events/'}#calendar`;
      const parts = chicagoParts(event.startAt);
      const month = parts
        ? new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'America/Chicago' }).format(
            validDate(event.startAt),
          )
        : '';
      const badge = eventCategoryBadge(event.category);
      row.innerHTML = `
        <div class="ev-db"><span class="ev-mo">${escapeHtml(month)}</span><span class="ev-dy">${parts ? parts.day : ''}</span></div>
        <div><div class="ev-t">${escapeHtml(event.title)}</div>${event.venue ? `<div class="ev-w">${escapeHtml(event.venue)}</div>` : ''}</div>
        <span class="ev-badge ${badge.className}">${escapeHtml(badge.label)}</span>`;
      return row;
    }),
  );
}

function paintCalendar(root, state) {
  const month = root.querySelector('[data-cal-month]');
  const grid = root.querySelector('[data-cal-grid]');
  const detail = root.querySelector('[data-cal-detail]');
  if (
    !(month instanceof HTMLElement) ||
    !(grid instanceof HTMLElement) ||
    !(detail instanceof HTMLElement)
  ) {
    return;
  }
  const monthEvents = eventsForMonth(state.events, state.year, state.month);
  const eventDates = new Set(monthEvents.map((event) => chicagoDateKey(event.startAt)));
  month.textContent = monthLabel(state.year, state.month);
  grid.replaceChildren(
    ...buildMonthCells(state.year, state.month, eventDates, { todayKey: todayChicagoKey() }).map(
      (cell) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'evp-day';
        button.disabled = !cell.inMonth;
        if (!cell.inMonth) button.classList.add('other-month');
        if (cell.hasEvent) button.classList.add('has-event');
        if (cell.isToday) button.classList.add('today');
        if (state.selectedKey === cell.key) button.classList.add('selected');
        button.innerHTML = cell.inMonth
          ? `<span class="evp-day-num">${cell.day}</span>${cell.hasEvent ? '<span class="evp-day-dot"></span>' : ''}`
          : '';
        button.setAttribute(
          'aria-label',
          cell.inMonth
            ? `${monthLabel(state.year, state.month)} ${cell.day}${cell.hasEvent ? ', has events' : ''}`
            : 'Outside this month',
        );
        if (cell.inMonth) {
          button.addEventListener('click', () => {
            state.selectedKey = cell.key;
            const [, , day] = cell.key.split('-').map(Number);
            const selected = eventsOnChicagoDate(state.events, state.year, state.month, day);
            paintCalendar(root, state);
            renderDetail(
              detail,
              selected,
              selected.length
                ? ''
                : 'No public events on this date. This calendar does not book meetings.',
            );
          });
        }
        return button;
      },
    ),
  );
  if (!state.selectedKey) {
    renderDetail(
      detail,
      monthEvents,
      monthEvents.length
        ? ''
        : 'Public events will appear here as they are published. This calendar shows dates and details only — it does not book meetings.',
    );
  }
  paintMonthStrip(root, state);
}

async function readPublicEvents(url) {
  if (!url) return null;
  const href = new URL(url, window.location.href);
  href.searchParams.set('t', String(Date.now()));
  const abortController = new AbortController();
  const timeout = window.setTimeout(() => abortController.abort(), 5_000);
  try {
    const response = await fetch(href, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: abortController.signal,
    });
    if (!response.ok) return null;
    return eventsFromFeedPayload(await response.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function refreshPublicEvents(state, urls) {
  const batches = await Promise.all(urls.map((url) => readPublicEvents(url)));
  const merged = mergePublicEvents(...batches.filter(Boolean));
  if (!merged.length && !batches.some(Boolean)) return false;
  const next = JSON.stringify(merged);
  const changed = next !== JSON.stringify(state.events);
  if (changed) state.events = merged;
  return changed;
}

async function loadEventsCalendar(root) {
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    events: [],
    selectedKey: '',
  };
  const feedUrls = [root.dataset.liveFeedUrl, root.dataset.feedUrl].filter(Boolean);

  document.querySelector('[data-month-strip]')?.addEventListener('click', (event) => {
    const card = event.target instanceof Element ? event.target.closest('[data-month-year]') : null;
    if (!(card instanceof HTMLElement)) return;
    const year = Number(card.dataset.monthYear);
    const month = Number(card.dataset.monthIndex);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    jumpCalendarToMonth(root, state, year, month);
  });

  root.querySelector('[data-cal-prev]')?.addEventListener('click', () => {
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    state.selectedKey = '';
    paintCalendar(root, state);
  });
  root.querySelector('[data-cal-next]')?.addEventListener('click', () => {
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    state.selectedKey = '';
    paintCalendar(root, state);
  });
  paintCalendar(root, state);
  const changed = await refreshPublicEvents(state, feedUrls);
  if (changed) paintCalendar(root, state);
  window.setInterval(async () => {
    const changed = await refreshPublicEvents(state, feedUrls);
    if (changed) paintCalendar(root, state);
  }, EVENTS_CALENDAR_REFRESH_MS);
}

async function loadHomeEvents(root) {
  const feedUrls = [root.dataset.liveFeedUrl, root.dataset.feedUrl].filter(Boolean);
  const state = { events: [] };
  await refreshPublicEvents(state, feedUrls);
  paintHomeEvents(root, state.events);
  window.setInterval(async () => {
    const changed = await refreshPublicEvents(state, feedUrls);
    if (changed) paintHomeEvents(root, state.events);
  }, EVENTS_CALENDAR_REFRESH_MS);
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-events-calendar]').forEach((root) => {
    if (root instanceof HTMLElement) loadEventsCalendar(root);
  });
  document.querySelectorAll('[data-home-events]').forEach((root) => {
    if (root instanceof HTMLElement) loadHomeEvents(root);
  });
}
