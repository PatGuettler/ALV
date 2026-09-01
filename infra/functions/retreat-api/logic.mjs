export const ALLOWED_STATUSES = new Set(['submitted', 'approved', 'declined']);

export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function json(statusCode, body, origin, allowedOrigins) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, allowedOrigins),
    },
    body: JSON.stringify(body),
  };
}

export function originOf(event) {
  return event.headers?.origin || event.headers?.Origin || '';
}

export function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
}

export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function parseApplication(payload) {
  const fullName = cleanText(payload?.fullName, 120);
  const email = cleanText(payload?.email, 254).toLowerCase();
  const phone = cleanText(payload?.phone, 40);
  const program = cleanText(payload?.program, 80);
  const message = cleanText(payload?.message, 1000);
  const consent = payload?.consent === true;

  if (!fullName || !email.includes('@') || !consent) {
    return { ok: false, error: 'invalid_application' };
  }

  return { ok: true, fields: { fullName, email, phone, program, message, consent } };
}

export function matchRoute(method, path) {
  if (method === 'OPTIONS') return 'options';
  if (method === 'POST' && path.endsWith('/v1/applications')) return 'create';
  if (method === 'GET' && /\/v1\/staff\/applications\/[^/]+$/.test(path)) return 'get';
  if (method === 'GET' && path.endsWith('/v1/staff/applications')) return 'list';
  if (method === 'PATCH' && /\/v1\/staff\/applications\/[^/]+$/.test(path)) return 'patch';
  return 'not_found';
}

export function applicationIdFrom(event) {
  const path = event.rawPath || event.path || '';
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export function parseListStatus(queryStatus) {
  const status = cleanText(queryStatus || 'submitted', 40) || 'submitted';
  if (!ALLOWED_STATUSES.has(status)) return { ok: false, error: 'invalid_status' };
  return { ok: true, status };
}

export function parseStaffPatch(payload) {
  const status = cleanText(payload?.status, 40);
  const note = cleanText(payload?.note, 500);
  if (!ALLOWED_STATUSES.has(status)) return { ok: false, error: 'invalid_status' };
  return { ok: true, status, note };
}

export function buildApplicationItem({ id, submittedAt, fields }) {
  return {
    pk: `APP#${id}`,
    sk: 'VERSION#1',
    id,
    ...fields,
    status: 'submitted',
    submittedAt,
    version: 1,
  };
}

export function publicStaffRecord(item) {
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    phone: item.phone,
    program: item.program,
    message: item.message,
    status: item.status,
    submittedAt: item.submittedAt,
    note: item.note || '',
    reviewedAt: item.reviewedAt || null,
  };
}
