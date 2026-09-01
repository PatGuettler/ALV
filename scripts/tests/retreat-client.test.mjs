import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applicationPayloadFromFormData,
  applicationReference,
  applicationReviewSections,
  signatureMatches,
} from '../../src/scripts/retreat-application.js';
import {
  staffAuthorizeUrl,
  staffDetailSections,
  staffRedirectUri,
} from '../../src/scripts/retreat-staff.js';

function applicationFormData() {
  const data = new FormData();
  const fields = {
    applicantType: 'military',
    retreatType: 'mens',
    timingPreference: 'next-available',
    firstName: 'Pat',
    lastName: 'Guettler',
    email: 'pat@example.com',
    phone: '555-0100',
    city: 'Birmingham',
    state: 'AL',
    postalCode: '35203',
    militaryBranch: 'army',
    militaryStatus: 'veteran',
    employmentStatus: 'full-time',
    emergencyName: 'Casey Guettler',
    emergencyRelationship: 'Spouse',
    emergencyPhone: '555-0101',
    goals: 'Build community.',
    signature: 'Pat Guettler',
    signatureDate: '2026-09-01',
  };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  for (const name of [
    'accuracyAgreement',
    'contactConsent',
    'placementAgreement',
    'policyAgreement',
  ]) {
    data.set(name, 'on');
  }
  data.append('workforceInterests', 'resume');
  data.append('workforceInterests', 'training');
  return data;
}

test('applicationPayloadFromFormData creates the versioned nested payload', () => {
  const payload = applicationPayloadFromFormData(applicationFormData(), {
    submissionId: '01991f38-7165-7cc8-a1bb-5ba46bc444b8',
    consentTimestamp: '2026-09-01T12:00:00.000Z',
  });
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.applicant.firstName, 'Pat');
  assert.equal(payload.service.kind, 'military');
  assert.deepEqual(payload.workforce.interests, ['resume', 'training']);
  assert.equal(payload.finalDetails.agreements.contact, true);
  assert.equal(payload.consent.version, '2026-09-01');
});

test('applicationPayloadFromFormData includes spouse and responder conditions only when selected', () => {
  const data = applicationFormData();
  data.set('applicantType', 'first-responder');
  data.set('retreatType', 'marriage');
  data.set('spouseFirstName', 'Casey');
  data.set('spouseLastName', 'Guettler');
  data.set('responderType', 'ems');
  data.set('agency', 'Example EMS');
  const payload = applicationPayloadFromFormData(data);
  assert.equal(payload.applicant.spouse.firstName, 'Casey');
  assert.equal(payload.service.kind, 'first-responder');
  assert.equal(payload.service.type, 'ems');
});

test('signatureMatches normalizes case and whitespace', () => {
  assert.equal(signatureMatches('Pat', 'Guettler', '  PAT   guettler '), true);
  assert.equal(signatureMatches('Pat', 'Guettler', 'Someone Else'), false);
});

test('review helpers produce safe display sections and receipt references', () => {
  const payload = applicationPayloadFromFormData(applicationFormData());
  const sections = applicationReviewSections(payload);
  assert.deepEqual(
    sections.map((section) => section.title),
    ['Retreat', 'Applicant', 'Service', 'Workforce', 'Final details'],
  );
  assert.equal(applicationReference('abc-123'), 'ABC-123');
});

test('staffRedirectUri keeps the GitHub Pages repo path', () => {
  assert.equal(
    staffRedirectUri('https://patguettler.github.io', '/ALV/'),
    'https://patguettler.github.io/ALV/warrior-retreat-staff/',
  );
  assert.equal(
    staffRedirectUri('http://127.0.0.1:4321', '/'),
    'http://127.0.0.1:4321/warrior-retreat-staff/',
  );
});

test('staffAuthorizeUrl builds a PKCE hosted UI URL', () => {
  const href = staffAuthorizeUrl({
    cognitoDomain: 'https://alv-prod-retreat-286801153738.auth.us-east-1.amazoncognito.com',
    clientId: '37tsmb3p4du202e1vmstblsrui',
    redirectUri: 'https://patguettler.github.io/ALV/warrior-retreat-staff/',
    challenge: 'abc',
  });
  const url = new URL(href);
  assert.equal(url.pathname, '/oauth2/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('staffDetailSections exposes approved applicant fields without internal keys', () => {
  const payload = applicationPayloadFromFormData(applicationFormData());
  const sections = staffDetailSections({
    id: 'abc',
    fullName: 'Pat Guettler',
    email: 'pat@example.com',
    phone: '555-0100',
    applicantType: 'military',
    retreatType: 'mens',
    submittedAt: '2026-09-01T12:00:00.000Z',
    ...payload,
  });
  assert.equal(
    sections.some((section) => section.title === 'Service history'),
    true,
  );
  assert.equal(JSON.stringify(sections).includes('APP#'), false);
});
