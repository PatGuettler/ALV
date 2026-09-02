import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applicationPayloadFromFormData,
  applicationReference,
  applicationReviewSections,
  fieldIssue,
  formatPhoneNumber,
  formatPostalCode,
  isValidEmail,
  isValidPhone,
  isValidPostalCode,
  messageForApiError,
  signatureMatches,
} from '../../src/scripts/retreat-application.js';
import {
  filterStaffRecords,
  formatStaffValue,
  staffAuthorizeUrl,
  staffDashboardStats,
  staffDetailSections,
  staffRedirectUri,
  staffReference,
  statusBadgeClass,
} from '../../src/scripts/retreat-staff.js';

function applicationFormData() {
  const data = new FormData();
  const fields = {
    applicantType: 'military',
    retreatType: 'mens',
    timingPreference: 'next-available',
    firstName: 'Pat',
    lastName: 'Guettler',
    dateOfBirth: '1985-01-15',
    email: 'pat@example.com',
    phone: '2055550100',
    city: 'Birmingham',
    state: 'AL',
    postalCode: '35203',
    militaryBranch: 'army',
    militaryStatus: 'veteran',
    employmentStatus: 'full-time',
    phqHopeless: '1',
    phqInterest: '2',
    anxietyFrequency: '3',
    nightmares: 'occasionally',
    mentalHealthOverall: '3',
    inCare: 'yes',
    suicideHistory: 'no',
    crisisStatus: 'stable',
    medicalConditions: 'test',
    medications: 'none',
    allergies: 'none',
    mobility: 'none',
    dietary: 'none',
    serviceDog: 'none',
    emergencyName: 'Casey Guettler',
    emergencyRelationship: 'Spouse',
    emergencyPhone: '(205) 555-0101',
    goals: 'Build community.',
    signature: 'Pat Guettler',
    signatureDate: '2026-09-01',
  };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  data.append('diagnoses', 'ptsd');
  data.append('diagnoses', 'anxiety');
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
  assert.equal(payload.applicant.phone, '(205) 555-0100');
  assert.equal(payload.finalDetails.emergencyContact.phone, '(205) 555-0101');
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

test('phone and ZIP helpers format as the applicant types and reject incomplete values', () => {
  assert.equal(formatPhoneNumber('2055550100'), '(205) 555-0100');
  assert.equal(formatPhoneNumber('1 (205) 555-0100'), '(205) 555-0100');
  assert.equal(formatPhoneNumber('205555'), '(205) 555');
  assert.equal(isValidPhone('(205) 555-0100'), true);
  assert.equal(isValidPhone('555-0100'), false);
  assert.equal(formatPostalCode('352031234'), '35203-1234');
  assert.equal(isValidPostalCode('35203'), true);
  assert.equal(isValidPostalCode('3520'), false);
  assert.equal(isValidEmail('pat@example.com'), true);
  assert.equal(isValidEmail('pat@example'), false);
});

test('fieldIssue names the exact problem for required and formatted fields', () => {
  const data = applicationFormData();
  assert.equal(fieldIssue('phone', data), '');
  data.set('phone', '555-0100');
  assert.match(fieldIssue('phone', data), /10-digit/);
  data.set('email', 'pat@office');
  assert.match(fieldIssue('email', data), /name@example.com/);
  data.set('postalCode', '3520');
  assert.match(fieldIssue('postalCode', data), /ZIP/);
  data.set('signature', 'Someone Else');
  assert.match(fieldIssue('signature', data), /first and last name/);
});

test('messageForApiError prefers the server field message', () => {
  assert.equal(
    messageForApiError({
      error: 'invalid_applicant',
      field: 'phone',
      message: 'Enter a 10-digit U.S. phone number, like (205) 555-0100.',
    }),
    'Enter a 10-digit U.S. phone number, like (205) 555-0100.',
  );
  assert.match(messageForApiError({ error: 'invalid_applicant' }), /personal information/);
});

test('review helpers produce safe display sections and receipt references', () => {
  const payload = applicationPayloadFromFormData(applicationFormData());
  const sections = applicationReviewSections(payload);
  assert.deepEqual(
    sections.map((section) => section.title),
    ['Retreat', 'Applicant', 'Service', 'Workforce', 'Health and wellbeing', 'Final details'],
  );
  assert.equal(applicationReference('abc-123'), 'ABC-123');
  assert.equal(payload.wellbeing.medicalConditions, 'test');
  assert.equal(payload.wellbeing.crisisStatus, 'stable');
  assert.deepEqual(payload.wellbeing.diagnoses, ['ptsd', 'anxiety']);
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
    id: '6191d7d7-3d64-4537-91db-42f676652150',
    fullName: 'Pat Guettler',
    email: 'pat@example.com',
    phone: '555-0100',
    applicantType: 'military',
    retreatType: 'mens',
    submittedAt: '2026-09-01T12:00:00.000Z',
    ...payload,
  });
  const health = sections.find((section) => section.title === 'Health and wellbeing');
  const application = sections.find((section) => section.title === 'Application');
  assert.equal(
    sections.some((section) => section.title === 'Service history'),
    true,
  );
  assert.equal(
    application.rows.find(([label]) => label === 'Reference number')[1],
    '6191D7D7-3D64-4537-91DB-42F676652150',
  );
  assert.equal(health.rows.find(([label]) => label === 'Medical conditions')[1], 'Test');
  assert.equal(health.rows.find(([label]) => label === 'Crisis status')[1], 'Stable');
  assert.match(health.rows.find(([label]) => label === 'PHQ hopeless')[1], /Several days/);
  assert.equal(JSON.stringify(sections).includes('APP#'), false);
});

test('staff search matches the applicant reference number and keeps UUID hyphens', () => {
  const id = '6191d7d7-3d64-4537-91db-42f676652150';
  assert.equal(staffReference(id), '6191D7D7-3D64-4537-91DB-42F676652150');
  assert.equal(formatStaffValue(id), '6191D7D7-3D64-4537-91DB-42F676652150');
  assert.equal(formatStaffValue('full-time'), 'Employed full-time');
});

test('staffDashboardStats counts live records without inventing totals', () => {
  const stats = staffDashboardStats([
    { status: 'submitted', previousRetreats: [] },
    { status: 'submitted', previousRetreats: ['mens'] },
    { status: 'approved', previousRetreats: [] },
  ]);
  assert.deepEqual(stats, { total: 3, submitted: 2, approved: 1, returning: 1 });
  assert.deepEqual(staffDashboardStats([]), {
    total: 0,
    submitted: 0,
    approved: 0,
    returning: 0,
  });
});

test('filterStaffRecords applies retreat, status, type, and search filters', () => {
  const records = [
    {
      id: '6191d7d7-3d64-4537-91db-42f676652150',
      fullName: 'Pat Guettler',
      email: 'pat@example.com',
      phone: '555-0100',
      retreatType: 'mens',
      applicantType: 'military',
      status: 'submitted',
    },
    {
      fullName: 'Casey Example',
      email: 'casey@example.com',
      phone: '555-0101',
      retreatType: 'marriage',
      applicantType: 'first-responder',
      status: 'approved',
    },
  ];
  assert.equal(filterStaffRecords(records, { retreatType: 'mens' }).length, 1);
  assert.equal(filterStaffRecords(records, { status: 'approved' })[0].fullName, 'Casey Example');
  assert.equal(filterStaffRecords(records, { applicantType: 'military' }).length, 1);
  assert.equal(filterStaffRecords(records, { query: 'casey' }).length, 1);
  assert.equal(filterStaffRecords(records, { query: '6191d7d7-3d64-4537-91db' }).length, 1);
  assert.equal(statusBadgeClass('submitted'), 'badge-pending');
  assert.equal(statusBadgeClass('declined'), 'badge-denied');
});
