export const MEDIA_SCHEMA_VERSION = 1;
export const MEDIA_KINDS = ['photo', 'album', 'video', 'quarterly-impact-story'];
export const MEDIA_STATUSES = ['draft', 'review', 'published', 'withdrawn'];

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validHttps(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeMediaRecord(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.schemaVersion !== MEDIA_SCHEMA_VERSION) return null;
  const kind = cleanText(value.kind, 40);
  const status = cleanText(value.status, 20);
  const id = cleanText(value.id, 80);
  const title = cleanText(value.title, 160);
  const caption = cleanText(value.caption, 400);
  const altText = cleanText(value.altText, 180);
  const transcript = cleanText(value.transcript, 20_000);
  const publishDate = cleanText(value.publishDate, 10);
  const reviewDate = cleanText(value.reviewDate, 10);
  const derivativeUrl = cleanText(value.derivativeUrl, 300);
  const consent = value.consent && typeof value.consent === 'object' ? value.consent : {};
  const rights = value.rights && typeof value.rights === 'object' ? value.rights : {};
  if (!MEDIA_KINDS.includes(kind) || !MEDIA_STATUSES.includes(status) || !id || !title) return null;
  if ((kind === 'photo' || kind === 'video' || kind === 'album') && !altText) return null;
  if (kind === 'video' && !transcript) return null;
  if (kind === 'quarterly-impact-story' && !cleanText(value.body, 4_000)) return null;
  if (status === 'published' || status === 'withdrawn') {
    if (consent.subjectConsent !== true || !validDate(cleanText(consent.recordedAt, 10)))
      return null;
    if (!cleanText(rights.owner, 120) || !cleanText(rights.license, 80)) return null;
  }
  if (status === 'published') {
    if (!validDate(publishDate) || !validDate(reviewDate)) return null;
    if (derivativeUrl && !validHttps(derivativeUrl)) return null;
  }

  return {
    schemaVersion: MEDIA_SCHEMA_VERSION,
    id,
    kind,
    title,
    caption,
    altText,
    transcript: kind === 'video' ? transcript : '',
    body: kind === 'quarterly-impact-story' ? cleanText(value.body, 4_000) : '',
    albumItems:
      kind === 'album' && Array.isArray(value.albumItems) ? value.albumItems.slice(0, 48) : [],
    status,
    publishDate,
    reviewDate,
    derivativeUrl: derivativeUrl && validHttps(derivativeUrl) ? derivativeUrl : '',
    originalKey: cleanText(value.originalKey, 200),
    consent: {
      subjectConsent: consent.subjectConsent === true,
      recordedAt: cleanText(consent.recordedAt, 10),
      recordedBy: cleanText(consent.recordedBy, 80),
    },
    rights: {
      owner: cleanText(rights.owner, 120),
      license: cleanText(rights.license, 80),
    },
  };
}
