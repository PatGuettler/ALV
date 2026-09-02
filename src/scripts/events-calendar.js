export const EVENTS_CALENDAR_FEED_VERSION = 1;
export const PUBLIC_EVENT_CATEGORIES = ['event', 'community', 'fundraiser', 'program'];
export const PUBLIC_EVENT_FIELDS = [
  'id',
  'title',
  'startAt',
  'endAt',
  'venue',
  'summary',
  'url',
  'category',
  'status',
];

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
      .slice(0, 240),
    url: safePublicUrl(value.url),
    category,
    status: 'published',
  };
}

export function publicEventFromCalendarRecord(record, { eventsCalendarId = '' } = {}) {
  if (!record || typeof record !== 'object' || !eventsCalendarId) return null;
  if (String(record.calendarId || '').trim() !== eventsCalendarId) return null;
  const status = String(record.appointmentStatus || record.status || '').toLowerCase();
  if (status && status !== 'confirmed' && status !== 'published' && status !== 'scheduled') {
    return null;
  }
  return normalizePublicEvent({
    id: record.id,
    title: record.title,
    startAt: record.startTime || record.startAt,
    endAt: record.endTime || record.endAt,
    venue: record.address || record.location || record.venue,
    summary: record.notes || record.summary,
    url: record.publicUrl || record.url,
    category: record.category || 'event',
    status: 'published',
  });
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
      return `<article class="evp-detail-event">
        <div class="evp-detail-date">${escapeHtml(formatEventDate(event.startAt))}</div>
        <h3 class="evp-detail-title">${escapeHtml(event.title)}</h3>
        ${event.venue ? `<p class="evp-detail-loc">${escapeHtml(event.venue)}</p>` : ''}
        ${event.summary ? `<p class="evp-detail-desc">${escapeHtml(event.summary)}</p>` : ''}
        ${link}
      </article>`;
    })
    .join('');
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
}

async function loadEventsCalendar(root) {
  const feedUrl = root.dataset.feedUrl;
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    events: [],
    selectedKey: '',
  };
  if (feedUrl) {
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort(), 5_000);
    try {
      const response = await fetch(feedUrl, {
        headers: { Accept: 'application/json' },
        signal: abortController.signal,
      });
      if (response.ok) {
        const feed = await response.json();
        if (feed?.version === EVENTS_CALENDAR_FEED_VERSION && Array.isArray(feed.events)) {
          state.events = feed.events.map(normalizePublicEvent).filter(Boolean);
        }
      }
    } catch {
      state.events = [];
    } finally {
      window.clearTimeout(timeout);
    }
  }

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
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-events-calendar]');
  if (root instanceof HTMLElement) loadEventsCalendar(root);
}
