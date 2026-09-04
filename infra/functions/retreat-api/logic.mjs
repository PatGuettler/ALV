export const APPLICATION_SCHEMA_VERSION = 2;
export const CONSENT_VERSION = '2026-09-01';
export const ALLOWED_STATUSES = new Set([
  'submitted',
  'approved',
  'waitlisted',
  'declined',
  'cancelled',
]);

const APPLICANT_TYPES = new Set(['military', 'first-responder']);
const RETREAT_TYPES = new Set(['mens', 'womens', 'marriage', 'endurance']);
const TIMING_PREFERENCES = new Set(['next-available', 'future-date', 'staff-contact']);
const MILITARY_BRANCHES = new Set([
  'army',
  'marine-corps',
  'navy',
  'air-force',
  'space-force',
  'coast-guard',
  'national-guard',
]);
const MILITARY_STATUSES = new Set([
  'veteran',
  'active-duty',
  'guard-reserve',
  'national-guard',
  'reserve',
  'medically-discharged',
  'retired',
]);
const RESPONDER_TYPES = new Set([
  'law-enforcement',
  'fire',
  'ems',
  'dispatch',
  'corrections',
  'search-rescue',
  'other',
]);
const RESPONDER_STATUSES = new Set([
  'active',
  'retired',
  'separated',
  'medical-separation',
  'leave',
]);
const YES_NO_PRIVATE = new Set(['', 'yes', 'no', 'prefer-not-to-answer']);
const EMPLOYMENT_STATUSES = new Set([
  'full-time',
  'part-time',
  'self-employed',
  'unemployed-looking',
  'unemployed-not-looking',
  'retired',
  'student',
  'unable-to-work',
  'prefer-not-to-answer',
]);
const EMPLOYMENT_SATISFACTION = new Set([
  '',
  'satisfied',
  'somewhat',
  'not-satisfied',
  'not-applicable',
  'prefer-not-to-answer',
]);
const WORKFORCE_INTERESTS = new Set([
  'resume',
  'interview',
  'career-placement',
  'training',
  'business',
  'education-benefits',
  'financial-literacy',
  'none',
]);
const PREVIOUS_RETREATS = new Set(['mens', 'womens', 'marriage', 'endurance']);

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

export function readBody(event, maximumBytes = 32_768) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  if (Buffer.byteLength(raw, 'utf8') > maximumBytes) throw new RangeError('body_too_large');
  return JSON.parse(raw);
}

export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function containsRestrictedIdentifier(value) {
  const text = String(value || '');
  if (!text) return false;
  if (/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/.test(text)) return true;
  if (/\b(?:ssn|social security number)\b/i.test(text) && /\d{3,}/.test(text)) return true;
  const digits = text.replace(/\D/g, '');
  return /\b(?:\d[ -]*){15,16}\b/.test(text) && (digits.length === 15 || digits.length === 16);
}

function cleanEnum(value, allowed) {
  const result = cleanText(value, 80);
  return allowed.has(result) ? result : null;
}

function cleanStringList(value, allowed, maxItems = 12) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = [...new Set(value.map((item) => cleanText(item, 80)))];
  return result.every((item) => allowed.has(item)) ? result : null;
}

function fail(error, field, message) {
  return { ok: false, error, field, message };
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function nationalPhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function validPhone(value) {
  return nationalPhoneDigits(value).length === 10;
}

function formatPhone(value) {
  const digits = nationalPhoneDigits(value);
  if (digits.length !== 10) return cleanText(value, 40);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function optionalPhone(value) {
  const trimmed = cleanText(value, 40);
  if (!trimmed) return { ok: true, value: '' };
  if (!validPhone(trimmed)) return { ok: false };
  return { ok: true, value: formatPhone(trimmed) };
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validTimestamp(value) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function normalizedName(value) {
  return cleanText(value, 120).replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function validYears(value) {
  if (value === '' || value === undefined || value === null) return true;
  return /^\d{1,2}$/.test(String(value)) && Number(value) >= 0 && Number(value) <= 60;
}

function validPostalCode(value) {
  return /^[0-9]{5}(-[0-9]{4})?$/.test(value);
}

export function parseApplication(payload) {
  if (payload?.schemaVersion !== APPLICATION_SCHEMA_VERSION) {
    return fail(
      'unsupported_schema',
      '',
      'This application form is out of date. Refresh the page and try again.',
    );
  }
  if (payload.health || payload.medical || payload.crisis || payload.wellbeing) {
    return fail(
      'sensitive_fields_not_accepted',
      '',
      'Health details must stay on the approved questions. Refresh and try again.',
    );
  }

  const submissionId = cleanText(payload.submissionId, 64);
  const applicantType = cleanEnum(payload.retreat?.applicantType, APPLICANT_TYPES);
  const retreatType = cleanEnum(payload.retreat?.retreatType, RETREAT_TYPES);
  const timingPreference = cleanEnum(payload.retreat?.timingPreference, TIMING_PREFERENCES);
  const enduranceEligible = cleanText(payload.retreat?.enduranceEligible, 10);
  const firstName = cleanText(payload.applicant?.firstName, 60);
  const lastName = cleanText(payload.applicant?.lastName, 60);
  const email = cleanText(payload.applicant?.email, 254).toLowerCase();
  const phone = cleanText(payload.applicant?.phone, 40);
  const street = cleanText(payload.applicant?.address?.street, 120);
  const city = cleanText(payload.applicant?.address?.city, 80);
  const state = cleanText(payload.applicant?.address?.state, 20);
  const postalCode = cleanText(payload.applicant?.address?.postalCode, 10);
  const county = cleanText(payload.applicant?.address?.county, 80);
  const referralSource = cleanText(payload.applicant?.referral?.source, 80);
  const referredBy = cleanText(payload.applicant?.referral?.referredBy, 120);

  if (!validUuid(submissionId)) {
    return fail('invalid_applicant', '', 'Refresh the page and start the application again.');
  }
  if (!applicantType) {
    return fail(
      'invalid_applicant',
      'applicantType',
      'Choose veteran / military or first responder.',
    );
  }
  if (!retreatType) {
    return fail('invalid_applicant', 'retreatType', 'Choose the retreat you are applying for.');
  }
  if (!timingPreference) {
    return fail('invalid_applicant', 'timingPreference', 'Select a preferred timing.');
  }
  if (retreatType === 'endurance' && enduranceEligible === 'no') {
    return fail(
      'invalid_applicant',
      'enduranceEligible',
      "The Endurance Retreat requires a prior Men's or Women's Retreat. Choose another retreat to continue.",
    );
  }
  if (!firstName) return fail('invalid_applicant', 'firstName', 'Enter your first name.');
  if (!lastName) return fail('invalid_applicant', 'lastName', 'Enter your last name.');
  if (!email) return fail('invalid_applicant', 'email', 'Enter your email address.');
  if (!validEmail(email)) {
    return fail('invalid_applicant', 'email', 'Enter an email address like name@example.com.');
  }
  if (!phone) return fail('invalid_applicant', 'phone', 'Enter your phone number.');
  if (!validPhone(phone)) {
    return fail(
      'invalid_applicant',
      'phone',
      'Enter a 10-digit U.S. phone number, like (205) 555-0100.',
    );
  }
  const formattedPhone = formatPhone(phone);
  if (!city) return fail('invalid_applicant', 'city', 'Enter your city.');
  if (!state) return fail('invalid_applicant', 'state', 'Select your state.');
  if (!postalCode) return fail('invalid_applicant', 'postalCode', 'Enter your ZIP code.');
  if (!validPostalCode(postalCode)) {
    return fail(
      'invalid_applicant',
      'postalCode',
      'Enter a 5-digit ZIP code, or ZIP+4 like 35203-1234.',
    );
  }

  let spouse = null;
  if (retreatType === 'marriage') {
    const spousePhone = optionalPhone(payload.applicant?.spouse?.phone);
    const spouseEmail = cleanText(payload.applicant?.spouse?.email, 254).toLowerCase();
    spouse = {
      firstName: cleanText(payload.applicant?.spouse?.firstName, 60),
      lastName: cleanText(payload.applicant?.spouse?.lastName, 60),
      email: spouseEmail,
      phone: spousePhone.ok ? spousePhone.value : '',
      dateOfBirth: cleanText(payload.applicant?.spouse?.dateOfBirth, 10),
      gender: cleanText(payload.applicant?.spouse?.gender, 40),
    };
    if (!spouse.firstName) {
      return fail('invalid_spouse', 'spouseFirstName', "Enter your spouse's first name.");
    }
    if (!spouse.lastName) {
      return fail('invalid_spouse', 'spouseLastName', "Enter your spouse's last name.");
    }
    if (spouseEmail && !validEmail(spouseEmail)) {
      return fail(
        'invalid_spouse',
        'spouseEmail',
        'Enter a valid spouse email, or leave it blank.',
      );
    }
    if (!spousePhone.ok) {
      return fail(
        'invalid_spouse',
        'spousePhone',
        'Enter a 10-digit spouse phone number, or leave it blank.',
      );
    }
  }

  let service;
  if (applicantType === 'military') {
    const branch = cleanEnum(payload.service?.branch, MILITARY_BRANCHES);
    const status = cleanEnum(payload.service?.status, MILITARY_STATUSES);
    const years = cleanText(String(payload.service?.years ?? ''), 2);
    const combatDeployment = cleanEnum(payload.service?.combatDeployment ?? '', YES_NO_PRIVATE);
    if (payload.service?.kind !== 'military') {
      return fail('invalid_service', 'applicantType', 'Select veteran / military service details.');
    }
    if (!status) {
      return fail('invalid_service', 'militaryStatus', 'Select your current military status.');
    }
    if (!branch) {
      return fail('invalid_service', 'militaryBranch', 'Select your branch of service.');
    }
    if (!validYears(years)) {
      return fail(
        'invalid_service',
        'militaryYears',
        'Enter years of service as a whole number from 0 to 60.',
      );
    }
    if (combatDeployment === null) {
      return fail(
        'invalid_service',
        'combatDeployment',
        'Choose yes, no, or prefer not to answer for combat-zone deployment.',
      );
    }
    service = {
      kind: 'military',
      branch,
      status,
      years,
      rank: cleanText(payload.service?.rank, 40),
      mos: cleanText(payload.service?.mos, 40),
      enteredService: cleanText(payload.service?.enteredService, 10),
      separatedService: cleanText(payload.service?.separatedService, 10),
      dischargeType: cleanText(payload.service?.dischargeType, 40),
      component: cleanText(payload.service?.component, 40),
      vaRating: cleanText(payload.service?.vaRating, 20),
      vaCare: cleanText(payload.service?.vaCare, 40),
      combatDeployment,
      combatTheaters: cleanText(payload.service?.combatTheaters, 120),
      verificationStatus: 'staff-follow-up',
    };
  } else {
    const type = cleanEnum(payload.service?.type, RESPONDER_TYPES);
    const status = cleanEnum(payload.service?.status, RESPONDER_STATUSES);
    const years = cleanText(String(payload.service?.years ?? ''), 2);
    const criticalIncident = cleanEnum(payload.service?.criticalIncident ?? '', YES_NO_PRIVATE);
    const agency = cleanText(payload.service?.agency, 120);
    if (payload.service?.kind !== 'first-responder') {
      return fail('invalid_service', 'applicantType', 'Select first responder service details.');
    }
    if (!type) {
      return fail('invalid_service', 'responderType', 'Select your first responder type.');
    }
    if (!agency) {
      return fail('invalid_service', 'agency', 'Enter your agency or department.');
    }
    if (!status) {
      return fail('invalid_service', 'responderStatus', 'Select your employment status.');
    }
    if (!validYears(years)) {
      return fail(
        'invalid_service',
        'responderYears',
        'Enter years of service as a whole number from 0 to 60.',
      );
    }
    if (criticalIncident === null) {
      return fail(
        'invalid_service',
        'criticalIncident',
        'Choose yes, no, or prefer not to answer for critical incidents.',
      );
    }
    service = {
      kind: 'first-responder',
      type,
      agency,
      status,
      years,
      rank: cleanText(payload.service?.rank, 60),
      agencyLocation: cleanText(payload.service?.agencyLocation, 120),
      criticalIncident,
      verificationStatus: 'staff-follow-up',
    };
  }

  const employmentStatus = cleanEnum(payload.workforce?.employmentStatus, EMPLOYMENT_STATUSES);
  const satisfaction = cleanEnum(payload.workforce?.satisfaction ?? '', EMPLOYMENT_SATISFACTION);
  const interests = cleanStringList(payload.workforce?.interests ?? [], WORKFORCE_INTERESTS);
  if (!employmentStatus) {
    return fail('invalid_workforce', 'employmentStatus', 'Select your employment status.');
  }
  if (satisfaction === null) {
    return fail(
      'invalid_workforce',
      'employmentSatisfaction',
      'Select whether you are satisfied with your employment situation.',
    );
  }
  if (interests === null) {
    return fail(
      'invalid_workforce',
      'workforceInterests',
      'Select workforce interests from the listed options.',
    );
  }

  const emergencyPhone = optionalPhone(payload.finalDetails?.emergencyContact?.phone);
  const emergencySecondary = optionalPhone(payload.finalDetails?.emergencyContact?.secondaryPhone);
  const emergencyContact = {
    name: cleanText(payload.finalDetails?.emergencyContact?.name, 120),
    relationship: cleanText(payload.finalDetails?.emergencyContact?.relationship, 60),
    phone: emergencyPhone.ok ? emergencyPhone.value : '',
    secondaryPhone: emergencySecondary.ok ? emergencySecondary.value : '',
  };
  const previousRetreats = cleanStringList(
    payload.finalDetails?.previousRetreats ?? [],
    PREVIOUS_RETREATS,
    4,
  );
  const goals = cleanText(payload.finalDetails?.goals, 1500);
  const signature = cleanText(payload.finalDetails?.signature, 120);
  const signatureDate = cleanText(payload.finalDetails?.signatureDate, 10);
  const agreements = payload.finalDetails?.agreements || {};
  const consentVersion = cleanText(payload.consent?.version, 40);
  const consentAcceptedAt = cleanText(payload.consent?.acceptedAt, 40);

  if (!emergencyContact.name) {
    return fail('invalid_final_details', 'emergencyName', 'Enter an emergency contact name.');
  }
  if (!emergencyContact.relationship) {
    return fail(
      'invalid_final_details',
      'emergencyRelationship',
      'Enter how the emergency contact is related to you.',
    );
  }
  if (!payload.finalDetails?.emergencyContact?.phone) {
    return fail(
      'invalid_final_details',
      'emergencyPhone',
      "Enter the emergency contact's phone number.",
    );
  }
  if (!emergencyPhone.ok) {
    return fail(
      'invalid_final_details',
      'emergencyPhone',
      'Enter a 10-digit U.S. phone number, like (205) 555-0100.',
    );
  }
  if (!emergencySecondary.ok) {
    return fail(
      'invalid_final_details',
      'emergencySecondaryPhone',
      'Enter a 10-digit backup phone number, or leave it blank.',
    );
  }
  if (previousRetreats === null) {
    return fail(
      'invalid_final_details',
      'previousRetreats',
      'Select previous ALV retreats from the listed options.',
    );
  }
  if (!goals) {
    return fail(
      'invalid_final_details',
      'goals',
      'Tell us what you hope to gain from this retreat.',
    );
  }
  if (agreements.accuracy !== true) {
    return fail(
      'invalid_final_details',
      'accuracyAgreement',
      'Confirm that your answers are accurate.',
    );
  }
  if (agreements.contact !== true) {
    return fail(
      'invalid_final_details',
      'contactConsent',
      'Consent to ALV storing this application and contacting you.',
    );
  }
  if (agreements.placement !== true) {
    return fail(
      'invalid_final_details',
      'placementAgreement',
      'Confirm that applying does not guarantee a retreat place.',
    );
  }
  if (agreements.policies !== true) {
    return fail(
      'invalid_final_details',
      'policyAgreement',
      'Agree to follow retreat policies provided by ALV staff.',
    );
  }
  if (normalizedName(signature) !== normalizedName(`${firstName} ${lastName}`)) {
    return fail(
      'invalid_final_details',
      'signature',
      "The digital signature must match the applicant's first and last name.",
    );
  }
  if (!validDate(signatureDate)) {
    return fail('invalid_final_details', 'signatureDate', 'Enter a valid signature date.');
  }
  if (consentVersion !== CONSENT_VERSION || !validTimestamp(consentAcceptedAt)) {
    return fail(
      'invalid_final_details',
      'contactConsent',
      'Refresh the page and accept the current application agreement.',
    );
  }

  const restrictedFields = [
    [goals, 'goals', 'retreat goals'],
    [cleanText(payload.finalDetails?.additionalNotes, 1500), 'additionalNotes', 'additional notes'],
    [cleanText(payload.workforce?.notes, 1000), 'workforceNotes', 'workforce notes'],
    [street, 'street', 'street address'],
    [referredBy, 'referredBy', 'referral notes'],
    [cleanText(payload.service?.combatTheaters, 120), 'combatTheaters', 'combat theaters'],
  ];
  for (const [value, field, label] of restrictedFields) {
    if (containsRestrictedIdentifier(value)) {
      return fail(
        'restricted_identifier',
        field,
        `Do not enter Social Security numbers or payment card numbers in ${label}.`,
      );
    }
  }

  return {
    ok: true,
    id: submissionId,
    fields: {
      schemaVersion: APPLICATION_SCHEMA_VERSION,
      fullName: `${firstName} ${lastName}`,
      email,
      phone: formattedPhone,
      applicantType,
      retreatType,
      retreat: { applicantType, retreatType, timingPreference, enduranceEligible },
      applicant: {
        firstName,
        lastName,
        dateOfBirth: cleanText(payload.applicant?.dateOfBirth, 10),
        gender: cleanText(payload.applicant?.gender, 40),
        maritalStatus: cleanText(payload.applicant?.maritalStatus, 40),
        dependents: cleanText(payload.applicant?.dependents, 20),
        raceEthnicity: cleanText(payload.applicant?.raceEthnicity, 40),
        householdIncome: cleanText(payload.applicant?.householdIncome, 40),
        educationLevel: cleanText(payload.applicant?.educationLevel, 40),
        email,
        phone: formattedPhone,
        address: { street, city, state, postalCode, county },
        referral: { source: referralSource, referredBy },
        spouse,
      },
      service,
      workforce: {
        employmentStatus,
        employer: cleanText(payload.workforce?.employer, 120),
        jobTitle: cleanText(payload.workforce?.jobTitle, 100),
        industry: cleanText(payload.workforce?.industry, 40),
        satisfaction,
        challenge: cleanText(payload.workforce?.challenge, 40),
        interests,
        notes: cleanText(payload.workforce?.notes, 1000),
      },
      finalDetails: {
        emergencyContact,
        previousRetreats,
        previousRetreatYears: cleanText(payload.finalDetails?.previousRetreatYears, 60),
        goals,
        additionalNotes: cleanText(payload.finalDetails?.additionalNotes, 1500),
        agreements: { accuracy: true, contact: true, placement: true, policies: true },
        signature,
        signatureDate,
      },
      consent: { version: consentVersion, acceptedAt: consentAcceptedAt },
    },
  };
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
  const note = cleanText(payload?.note, 1000);
  const expectedVersion = Number(payload?.expectedVersion);
  if (!ALLOWED_STATUSES.has(status)) return { ok: false, error: 'invalid_status' };
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { ok: false, error: 'invalid_version' };
  }
  return { ok: true, status, note, expectedVersion };
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

export function staffSummaryRecord(item) {
  const previousRetreats = Array.isArray(item.finalDetails?.previousRetreats)
    ? item.finalDetails.previousRetreats
    : [];
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    phone: item.phone,
    applicantType: item.applicantType || item.retreat?.applicantType || '',
    retreatType: item.retreatType || item.retreat?.retreatType || '',
    timingPreference: item.retreat?.timingPreference || '',
    previousRetreats,
    status: item.status,
    submittedAt: item.submittedAt,
    version: item.version,
  };
}

export function publicStaffRecord(item) {
  return {
    ...staffSummaryRecord(item),
    schemaVersion: item.schemaVersion,
    retreat: item.retreat,
    applicant: item.applicant,
    service: item.service,
    workforce: item.workforce,
    finalDetails: item.finalDetails,
    consent: item.consent,
    note: item.note || '',
    reviewedAt: item.reviewedAt || null,
    reviewedBy: item.reviewedBy || null,
  };
}
