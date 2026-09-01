import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applicationIdFrom,
  buildApplicationItem,
  cleanText,
  corsHeaders,
  json,
  matchRoute,
  originOf,
  parseAllowedOrigins,
  parseApplication,
  parseListStatus,
  parseStaffPatch,
  publicStaffRecord,
  readBody,
} from '../../infra/functions/retreat-api/logic.mjs';

const allowed = ['http://127.0.0.1:4321', 'https://patguettler.github.io'];

test('parseAllowedOrigins splits and trims a comma list', () => {
  assert.deepEqual(parseAllowedOrigins(' http://localhost:4321, https://patguettler.github.io '), [
    'http://localhost:4321',
    'https://patguettler.github.io',
  ]);
});

test('corsHeaders allows a listed origin and falls back otherwise', () => {
  assert.equal(
    corsHeaders('https://patguettler.github.io', allowed)['Access-Control-Allow-Origin'],
    allowed[1],
  );
  assert.equal(
    corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin'],
    allowed[0],
  );
  assert.equal(corsHeaders('https://evil.example', [])['Access-Control-Allow-Origin'], '');
});

test('json responses include no-store JSON headers', () => {
  const response = json(400, { error: 'invalid_application' }, allowed[0], allowed);
  assert.equal(response.statusCode, 400);
  assert.equal(response.headers['Content-Type'], 'application/json');
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(JSON.parse(response.body).error, 'invalid_application');
});

test('originOf reads origin or Origin', () => {
  assert.equal(originOf({ headers: { origin: 'http://localhost:4321' } }), 'http://localhost:4321');
  assert.equal(
    originOf({ headers: { Origin: 'https://patguettler.github.io' } }),
    'https://patguettler.github.io',
  );
  assert.equal(originOf({ headers: {} }), '');
});

test('readBody parses JSON and base64 JSON and rejects invalid JSON', () => {
  assert.deepEqual(readBody({}), {});
  assert.deepEqual(readBody({ body: '{"fullName":"Pat"}' }), { fullName: 'Pat' });
  assert.deepEqual(
    readBody({ body: Buffer.from('{"consent":true}').toString('base64'), isBase64Encoded: true }),
    { consent: true },
  );
  assert.throws(() => readBody({ body: '{not-json' }), SyntaxError);
});

test('cleanText trims, truncates, and ignores non-strings', () => {
  assert.equal(cleanText('  Hello  ', 4), 'Hell');
  assert.equal(cleanText(12, 10), '');
});

test('parseApplication accepts a valid payload and rejects incomplete ones', () => {
  const valid = parseApplication({
    fullName: ' Pat Guettler ',
    email: 'Pat@Example.com',
    phone: '555-0100',
    program: 'warrior-retreat',
    message: 'Need a weekend.',
    consent: true,
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.fields.fullName, 'Pat Guettler');
  assert.equal(valid.fields.email, 'pat@example.com');

  assert.equal(
    parseApplication({ fullName: 'Pat', email: 'pat@example.com', consent: false }).ok,
    false,
  );
  assert.equal(
    parseApplication({ fullName: '', email: 'pat@example.com', consent: true }).ok,
    false,
  );
  assert.equal(
    parseApplication({ fullName: 'Pat', email: 'not-an-email', consent: true }).ok,
    false,
  );
});

test('parseApplication truncates oversized fields', () => {
  const parsed = parseApplication({
    fullName: 'x'.repeat(200),
    email: `${'a'.repeat(250)}@x.com`,
    message: 'm'.repeat(2000),
    consent: true,
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.fields.fullName.length, 120);
  assert.equal(parsed.fields.email.length, 254);
  assert.equal(parsed.fields.message.length, 1000);
});

test('matchRoute identifies public, staff, options, and unknown paths', () => {
  assert.equal(matchRoute('OPTIONS', '/v1/applications'), 'options');
  assert.equal(matchRoute('POST', '/v1/applications'), 'create');
  assert.equal(matchRoute('GET', '/v1/staff/applications'), 'list');
  assert.equal(matchRoute('GET', '/v1/staff/applications/abc-123'), 'get');
  assert.equal(matchRoute('PATCH', '/v1/staff/applications/abc-123'), 'patch');
  assert.equal(matchRoute('GET', '/v1/staff/applications/abc-123/notes'), 'not_found');
  assert.equal(matchRoute('DELETE', '/v1/applications'), 'not_found');
});

test('applicationIdFrom uses the last path segment', () => {
  assert.equal(applicationIdFrom({ rawPath: '/v1/staff/applications/abc-123' }), 'abc-123');
});

test('parseListStatus defaults to submitted and rejects unknown values', () => {
  assert.deepEqual(parseListStatus(undefined), { ok: true, status: 'submitted' });
  assert.deepEqual(parseListStatus('approved'), { ok: true, status: 'approved' });
  assert.equal(parseListStatus('archived').ok, false);
});

test('parseStaffPatch requires an allowed status', () => {
  assert.deepEqual(parseStaffPatch({ status: 'declined', note: ' Not a fit ' }), {
    ok: true,
    status: 'declined',
    note: 'Not a fit',
  });
  assert.equal(parseStaffPatch({ status: 'maybe' }).ok, false);
});

test('buildApplicationItem and publicStaffRecord hide internal fields', () => {
  const item = buildApplicationItem({
    id: 'abc',
    submittedAt: '2026-08-31T00:00:00.000Z',
    fields: {
      fullName: 'Pat',
      email: 'pat@example.com',
      phone: '',
      program: 'warrior-retreat',
      message: 'Hello',
      consent: true,
    },
  });
  assert.equal(item.pk, 'APP#abc');
  assert.equal(item.status, 'submitted');

  const published = publicStaffRecord({
    ...item,
    reviewedBy: 'staff@example.com',
    note: undefined,
  });
  assert.equal(published.note, '');
  assert.equal(published.reviewedAt, null);
  assert.equal('pk' in published, false);
  assert.equal('reviewedBy' in published, false);
  assert.equal('consent' in published, false);
});
