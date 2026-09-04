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
  staffSummaryRecord,
  containsRestrictedIdentifier,
} from '../../infra/functions/retreat-api/logic.mjs';

const allowed = ['http://127.0.0.1:4321', 'https://patguettler.github.io'];

function validApplication(overrides = {}) {
  const payload = {
    schemaVersion: 2,
    submissionId: '01991f38-7165-7cc8-a1bb-5ba46bc444b8',
    retreat: {
      applicantType: 'military',
      retreatType: 'mens',
      timingPreference: 'next-available',
    },
    applicant: {
      firstName: ' Pat ',
      lastName: ' Guettler ',
      email: 'Pat@Example.com',
      phone: '(205) 555-0100',
      address: {
        street: '100 Main Street',
        city: 'Birmingham',
        state: 'AL',
        postalCode: '35203',
        county: 'Jefferson',
      },
      referral: { source: 'event', referredBy: 'ALV staff' },
      spouse: null,
    },
    service: {
      kind: 'military',
      branch: 'army',
      status: 'veteran',
      years: '8',
      rank: 'SGT',
      combatDeployment: 'yes',
      verificationStatus: 'staff-follow-up',
    },
    workforce: {
      employmentStatus: 'full-time',
      employer: 'Example',
      jobTitle: 'Operator',
      satisfaction: 'somewhat',
      interests: ['resume', 'training'],
      notes: 'Interested in a certification.',
    },
    finalDetails: {
      emergencyContact: {
        name: 'Casey Guettler',
        relationship: 'Spouse',
        phone: '(205) 555-0101',
        secondaryPhone: '',
      },
      previousRetreats: [],
      previousRetreatYears: '',
      goals: 'Reconnect with a peer community.',
      additionalNotes: '',
      agreements: { accuracy: true, contact: true, placement: true, policies: true },
      signature: 'Pat Guettler',
      signatureDate: '2026-09-01',
    },
    consent: { version: '2026-09-01', acceptedAt: '2026-09-01T12:00:00.000Z' },
  };
  return { ...payload, ...overrides };
}

test('parseAllowedOrigins splits and trims a comma list', () => {
  assert.deepEqual(parseAllowedOrigins(' http://localhost:4321, https://patguettler.github.io '), [
    'http://localhost:4321',
    'https://patguettler.github.io',
  ]);
});

test('corsHeaders allows a listed origin and falls back otherwise', () => {
  assert.equal(corsHeaders(allowed[1], allowed)['Access-Control-Allow-Origin'], allowed[1]);
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
  assert.equal(originOf({ headers: { origin: allowed[0] } }), allowed[0]);
  assert.equal(originOf({ headers: { Origin: allowed[1] } }), allowed[1]);
  assert.equal(originOf({ headers: {} }), '');
});

test('readBody parses JSON and base64 JSON and enforces its size limit', () => {
  assert.deepEqual(readBody({}), {});
  assert.deepEqual(readBody({ body: '{"name":"Pat"}' }), { name: 'Pat' });
  assert.deepEqual(
    readBody({ body: Buffer.from('{"consent":true}').toString('base64'), isBase64Encoded: true }),
    { consent: true },
  );
  assert.throws(() => readBody({ body: '{not-json' }), SyntaxError);
  assert.throws(() => readBody({ body: '12345' }, 4), RangeError);
});

test('cleanText trims, truncates, and ignores non-strings', () => {
  assert.equal(cleanText('  Hello  ', 4), 'Hell');
  assert.equal(cleanText(12, 10), '');
});

test('parseApplication accepts and normalizes the versioned applicant schema', () => {
  const parsed = parseApplication(validApplication());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.id, '01991f38-7165-7cc8-a1bb-5ba46bc444b8');
  assert.equal(parsed.fields.fullName, 'Pat Guettler');
  assert.equal(parsed.fields.email, 'pat@example.com');
  assert.equal(parsed.fields.phone, '(205) 555-0100');
  assert.equal(parsed.fields.service.branch, 'army');
  assert.deepEqual(parsed.fields.workforce.interests, ['resume', 'training']);
});

test('parseApplication enforces conditional spouse and service fields', () => {
  const marriage = validApplication({
    retreat: {
      applicantType: 'military',
      retreatType: 'marriage',
      timingPreference: 'next-available',
    },
  });
  assert.equal(parseApplication(marriage).error, 'invalid_spouse');
  assert.equal(parseApplication(marriage).field, 'spouseFirstName');
  assert.match(parseApplication(marriage).message, /spouse/);

  const responder = validApplication({
    retreat: {
      applicantType: 'first-responder',
      retreatType: 'endurance',
      timingPreference: 'staff-contact',
    },
    service: {
      kind: 'first-responder',
      type: 'ems',
      agency: 'Example EMS',
      status: 'active',
      years: '10',
      rank: 'Paramedic',
      criticalIncident: 'prefer-not-to-answer',
    },
  });
  assert.equal(parseApplication(responder).ok, true);
});

test('parseApplication rejects missing consent, mismatched signatures, and sensitive payloads', () => {
  assert.equal(
    parseApplication(validApplication({ schemaVersion: 1 })).error,
    'unsupported_schema',
  );
  assert.equal(
    parseApplication(validApplication({ health: { phq2: 5 } })).error,
    'sensitive_fields_not_accepted',
  );
  assert.equal(
    parseApplication(validApplication({ wellbeing: { crisisStatus: 'stable' } })).error,
    'sensitive_fields_not_accepted',
  );
  const badSignature = validApplication();
  badSignature.finalDetails.signature = 'Someone Else';
  assert.equal(parseApplication(badSignature).error, 'invalid_final_details');
  assert.equal(parseApplication(badSignature).field, 'signature');
  const noConsent = validApplication();
  noConsent.finalDetails.agreements.contact = false;
  assert.equal(parseApplication(noConsent).error, 'invalid_final_details');
  assert.equal(parseApplication(noConsent).field, 'contactConsent');
});

test('parseApplication names the invalid phone, email, and ZIP fields', () => {
  const shortPhone = validApplication();
  shortPhone.applicant.phone = '555-0100';
  assert.equal(parseApplication(shortPhone).ok, false);
  assert.equal(parseApplication(shortPhone).field, 'phone');
  assert.match(parseApplication(shortPhone).message, /10-digit/);

  const digits = validApplication();
  digits.applicant.phone = '2055550100';
  assert.equal(parseApplication(digits).ok, true);
  assert.equal(parseApplication(digits).fields.phone, '(205) 555-0100');

  const badZip = validApplication();
  badZip.applicant.address.postalCode = '3520';
  assert.equal(parseApplication(badZip).field, 'postalCode');

  const badEmail = validApplication();
  badEmail.applicant.email = 'pat@office';
  assert.equal(parseApplication(badEmail).field, 'email');
});

test('parseApplication rejects Social Security numbers in free text', () => {
  const payload = validApplication();
  payload.finalDetails.goals = 'Please call 123-45-6789';
  assert.equal(parseApplication(payload).error, 'restricted_identifier');
  assert.equal(parseApplication(payload).field, 'goals');
  assert.equal(containsRestrictedIdentifier('Reconnect with a peer community.'), false);
});

test('parseApplication truncates approved optional notes', () => {
  const payload = validApplication();
  payload.workforce.notes = 'n'.repeat(2000);
  payload.finalDetails.additionalNotes = 'a'.repeat(2500);
  const parsed = parseApplication(payload);
  assert.equal(parsed.fields.workforce.notes.length, 1000);
  assert.equal(parsed.fields.finalDetails.additionalNotes.length, 1500);
});

test('matchRoute identifies public, staff, options, and unknown paths', () => {
  assert.equal(matchRoute('OPTIONS', '/v1/applications'), 'options');
  assert.equal(matchRoute('POST', '/v1/applications'), 'create');
  assert.equal(matchRoute('GET', '/v1/staff/applications'), 'list');
  assert.equal(matchRoute('GET', '/v1/staff/applications/abc-123'), 'get');
  assert.equal(matchRoute('PATCH', '/v1/staff/applications/abc-123'), 'patch');
  assert.equal(matchRoute('GET', '/v1/staff/applications/abc-123/notes'), 'not_found');
});

test('applicationIdFrom uses the last path segment', () => {
  assert.equal(applicationIdFrom({ rawPath: '/v1/staff/applications/abc-123' }), 'abc-123');
});

test('parseListStatus supports the production decision statuses', () => {
  assert.deepEqual(parseListStatus(undefined), { ok: true, status: 'submitted' });
  assert.deepEqual(parseListStatus('waitlisted'), { ok: true, status: 'waitlisted' });
  assert.equal(parseListStatus('archived').ok, false);
});

test('parseStaffPatch requires an allowed status and optimistic version', () => {
  assert.deepEqual(
    parseStaffPatch({ status: 'declined', note: ' Not a fit ', expectedVersion: 2 }),
    {
      ok: true,
      status: 'declined',
      note: 'Not a fit',
      expectedVersion: 2,
    },
  );
  assert.equal(parseStaffPatch({ status: 'maybe', expectedVersion: 1 }).ok, false);
  assert.equal(parseStaffPatch({ status: 'approved' }).error, 'invalid_version');
});

test('staff summary and detail records hide DynamoDB keys', () => {
  const parsed = parseApplication(validApplication());
  const item = buildApplicationItem({
    id: parsed.id,
    submittedAt: '2026-09-01T12:00:00.000Z',
    fields: parsed.fields,
  });
  assert.equal(item.pk, `APP#${parsed.id}`);
  const summary = staffSummaryRecord(item);
  assert.equal(summary.retreatType, 'mens');
  assert.equal(summary.timingPreference, 'next-available');
  assert.deepEqual(summary.previousRetreats, []);
  assert.equal('applicant' in summary, false);
  const detail = publicStaffRecord(item);
  assert.equal(detail.applicant.address.city, 'Birmingham');
  assert.equal('wellbeing' in detail, false);
  assert.equal('pk' in detail, false);
  assert.equal('sk' in detail, false);
});
