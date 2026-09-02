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

function cleanEnum(value, allowed) {
  const result = cleanText(value, 80);
  return allowed.has(result) ? result : null;
}

function cleanStringList(value, allowed, maxItems = 12) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = [...new Set(value.map((item) => cleanText(item, 80)))];
  return result.every((item) => allowed.has(item)) ? result : null;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export function parseApplication(payload) {
  if (payload?.schemaVersion !== APPLICATION_SCHEMA_VERSION) {
    return { ok: false, error: 'unsupported_schema' };
  }
  if (payload.health || payload.medical || payload.crisis) {
    return { ok: false, error: 'sensitive_fields_not_accepted' };
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

  if (
    !validUuid(submissionId) ||
    !applicantType ||
    !retreatType ||
    !timingPreference ||
    (retreatType === 'endurance' && enduranceEligible === 'no') ||
    !firstName ||
    !lastName ||
    !validEmail(email) ||
    !phone ||
    !city ||
    !state ||
    !/^[0-9]{5}(-[0-9]{4})?$/.test(postalCode)
  ) {
    return { ok: false, error: 'invalid_applicant' };
  }

  let spouse = null;
  if (retreatType === 'marriage') {
    spouse = {
      firstName: cleanText(payload.applicant?.spouse?.firstName, 60),
      lastName: cleanText(payload.applicant?.spouse?.lastName, 60),
      email: cleanText(payload.applicant?.spouse?.email, 254).toLowerCase(),
      phone: cleanText(payload.applicant?.spouse?.phone, 40),
      dateOfBirth: cleanText(payload.applicant?.spouse?.dateOfBirth, 10),
      gender: cleanText(payload.applicant?.spouse?.gender, 40),
    };
    if (!spouse.firstName || !spouse.lastName || (spouse.email && !validEmail(spouse.email))) {
      return { ok: false, error: 'invalid_spouse' };
    }
  }

  let service;
  if (applicantType === 'military') {
    const branch = cleanEnum(payload.service?.branch, MILITARY_BRANCHES);
    const status = cleanEnum(payload.service?.status, MILITARY_STATUSES);
    const years = cleanText(String(payload.service?.years ?? ''), 2);
    const combatDeployment = cleanEnum(payload.service?.combatDeployment ?? '', YES_NO_PRIVATE);
    if (
      payload.service?.kind !== 'military' ||
      !branch ||
      !status ||
      !validYears(years) ||
      combatDeployment === null
    ) {
      return { ok: false, error: 'invalid_service' };
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
    if (
      payload.service?.kind !== 'first-responder' ||
      !type ||
      !agency ||
      !status ||
      !validYears(years) ||
      criticalIncident === null
    ) {
      return { ok: false, error: 'invalid_service' };
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
      departmentSupport: cleanText(payload.service?.departmentSupport, 40),
      verificationStatus: 'staff-follow-up',
    };
  }

  const employmentStatus = cleanEnum(payload.workforce?.employmentStatus, EMPLOYMENT_STATUSES);
  const satisfaction = cleanEnum(payload.workforce?.satisfaction ?? '', EMPLOYMENT_SATISFACTION);
  const interests = cleanStringList(payload.workforce?.interests ?? [], WORKFORCE_INTERESTS);
  if (!employmentStatus || satisfaction === null || interests === null) {
    return { ok: false, error: 'invalid_workforce' };
  }

  const emergencyContact = {
    name: cleanText(payload.finalDetails?.emergencyContact?.name, 120),
    relationship: cleanText(payload.finalDetails?.emergencyContact?.relationship, 60),
    phone: cleanText(payload.finalDetails?.emergencyContact?.phone, 40),
    secondaryPhone: cleanText(payload.finalDetails?.emergencyContact?.secondaryPhone, 40),
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

  if (
    !emergencyContact.name ||
    !emergencyContact.relationship ||
    !emergencyContact.phone ||
    previousRetreats === null ||
    !goals ||
    !Object.values({
      accuracy: agreements.accuracy === true,
      contact: agreements.contact === true,
      placement: agreements.placement === true,
      policies: agreements.policies === true,
    }).every(Boolean) ||
    normalizedName(signature) !== normalizedName(`${firstName} ${lastName}`) ||
    !validDate(signatureDate) ||
    consentVersion !== CONSENT_VERSION ||
    !validTimestamp(consentAcceptedAt)
  ) {
    return { ok: false, error: 'invalid_final_details' };
  }

  return {
    ok: true,
    id: submissionId,
    fields: {
      schemaVersion: APPLICATION_SCHEMA_VERSION,
      fullName: `${firstName} ${lastName}`,
      email,
      phone,
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
        phone,
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
      wellbeing: {
        phqHopeless: cleanText(payload.wellbeing?.phqHopeless, 2),
        phqInterest: cleanText(payload.wellbeing?.phqInterest, 2),
        anxietyFrequency: cleanText(payload.wellbeing?.anxietyFrequency, 2),
        nightmares: cleanText(payload.wellbeing?.nightmares, 40),
        mentalHealthOverall: cleanText(payload.wellbeing?.mentalHealthOverall, 2),
        diagnoses: Array.isArray(payload.wellbeing?.diagnoses)
          ? payload.wellbeing.diagnoses.map((item) => cleanText(item, 40)).slice(0, 12)
          : [],
        inCare: cleanText(payload.wellbeing?.inCare, 40),
        suicideHistory: cleanText(payload.wellbeing?.suicideHistory, 40),
        crisisStatus: cleanText(payload.wellbeing?.crisisStatus, 40),
        medicalConditions: cleanText(payload.wellbeing?.medicalConditions, 1500),
        medications: cleanText(payload.wellbeing?.medications, 1500),
        allergies: cleanText(payload.wellbeing?.allergies, 1000),
        mobility: cleanText(payload.wellbeing?.mobility, 200),
        dietary: cleanText(payload.wellbeing?.dietary, 200),
        serviceDog: cleanText(payload.wellbeing?.serviceDog, 40),
        dog: payload.wellbeing?.dog
          ? {
              name: cleanText(payload.wellbeing.dog.name, 60),
              breed: cleanText(payload.wellbeing.dog.breed, 80),
              certification: cleanText(payload.wellbeing.dog.certification, 80),
              tasks: cleanText(payload.wellbeing.dog.tasks, 200),
            }
          : null,
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
    wellbeing: item.wellbeing,
    finalDetails: item.finalDetails,
    consent: item.consent,
    note: item.note || '',
    reviewedAt: item.reviewedAt || null,
    reviewedBy: item.reviewedBy || null,
  };
}
