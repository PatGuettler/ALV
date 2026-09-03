export const APPLICATION_SCHEMA_VERSION = 2;
export const CONSENT_VERSION = '2026-09-01';

function text(data, name) {
  return String(data.get(name) || '').trim();
}

function values(data, name) {
  return data
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function checked(data, name) {
  return data.get(name) === 'on';
}

export function normalizePersonName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

export function signatureMatches(firstName, lastName, signature) {
  return (
    normalizePersonName(signature) === normalizePersonName(`${firstName || ''} ${lastName || ''}`)
  );
}

export function nationalPhoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits;
}

export function formatPhoneNumber(value) {
  const digits = nationalPhoneDigits(value).slice(0, 10);
  if (!digits) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhone(value) {
  return nationalPhoneDigits(value).length === 10;
}

export function formatPostalCode(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidPostalCode(value) {
  return /^[0-9]{5}(-[0-9]{4})?$/.test(String(value || '').trim());
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function formatYears(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 2);
}

export function isValidYears(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  return /^\d{1,2}$/.test(trimmed) && Number(trimmed) >= 0 && Number(trimmed) <= 60;
}

export function isValidCalendarDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

function todayStamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export const API_ERROR_MESSAGES = {
  unsupported_schema: 'This application form is out of date. Refresh the page and try again.',
  sensitive_fields_not_accepted:
    'Health details must stay on the approved questions. Refresh and try again.',
  invalid_json: 'The application could not be read. Check your answers and try again.',
  invalid_applicant: 'A personal information field is missing or not in the expected format.',
  invalid_spouse: 'Spouse first and last name are required for the Marriage Retreat.',
  invalid_service: 'A service history field is missing or not in the expected format.',
  invalid_workforce: 'Select your employment status before submitting.',
  invalid_final_details: 'Check your emergency contact, signature, and required agreements.',
  body_too_large: 'The application is too large to send. Shorten the longer answers and try again.',
};

export function messageForApiError(result) {
  const message = String(result?.message || '').trim();
  if (message) return message;
  return (
    API_ERROR_MESSAGES[result?.error] ||
    'The application contains an invalid answer. Review each step and try again.'
  );
}

export function fieldIssue(name, data) {
  const value = String(data.get(name) || '').trim();
  const retreatType = String(data.get('retreatType') || '').trim();
  const applicantType = String(data.get('applicantType') || '').trim();

  switch (name) {
    case 'applicantType':
      return ['military', 'first-responder'].includes(value)
        ? ''
        : 'Choose veteran / military or first responder.';
    case 'retreatType':
      return ['mens', 'womens', 'marriage', 'endurance'].includes(value)
        ? ''
        : 'Choose the retreat you are applying for.';
    case 'timingPreference':
      return ['next-available', 'future-date', 'staff-contact'].includes(value)
        ? ''
        : 'Select a preferred timing.';
    case 'enduranceEligible':
      if (retreatType !== 'endurance') return '';
      if (value === 'no') {
        return "The Endurance Retreat requires a prior Men's or Women's Retreat. Choose another retreat to continue.";
      }
      return value === 'yes'
        ? ''
        : "Say whether you have already attended a Men's or Women's Retreat.";
    case 'firstName':
      return value ? '' : 'Enter your first name.';
    case 'lastName':
      return value ? '' : 'Enter your last name.';
    case 'dateOfBirth':
      if (!isValidCalendarDate(value)) return 'Enter your date of birth.';
      return value < '1920-01-01' || value >= todayStamp()
        ? 'Enter a date of birth in the past.'
        : '';
    case 'email':
      if (!value) return 'Enter your email address.';
      return isValidEmail(value) ? '' : 'Enter an email address like name@example.com.';
    case 'phone':
      if (!value) return 'Enter your phone number.';
      return isValidPhone(value) ? '' : 'Enter a 10-digit U.S. phone number, like (205) 555-0100.';
    case 'city':
      return value ? '' : 'Enter your city.';
    case 'state':
      return value ? '' : 'Select your state.';
    case 'postalCode':
      if (!value) return 'Enter your ZIP code.';
      return isValidPostalCode(value) ? '' : 'Enter a 5-digit ZIP code, or ZIP+4 like 35203-1234.';
    case 'spouseFirstName':
      return retreatType === 'marriage' && !value ? "Enter your spouse's first name." : '';
    case 'spouseLastName':
      return retreatType === 'marriage' && !value ? "Enter your spouse's last name." : '';
    case 'spouseEmail':
      return value && !isValidEmail(value) ? 'Enter a valid spouse email, or leave it blank.' : '';
    case 'spousePhone':
      return value && !isValidPhone(value)
        ? 'Enter a 10-digit spouse phone number, or leave it blank.'
        : '';
    case 'militaryStatus':
      return applicantType === 'military' && !value ? 'Select your current military status.' : '';
    case 'militaryBranch':
      return applicantType === 'military' && !value ? 'Select your branch of service.' : '';
    case 'militaryYears':
      return value && !isValidYears(value)
        ? 'Enter years of service as a whole number from 0 to 60.'
        : '';
    case 'responderType':
      return applicantType === 'first-responder' && !value
        ? 'Select your first responder type.'
        : '';
    case 'agency':
      return applicantType === 'first-responder' && !value
        ? 'Enter your agency or department.'
        : '';
    case 'responderStatus':
      return applicantType === 'first-responder' && !value ? 'Select your employment status.' : '';
    case 'responderYears':
      return value && !isValidYears(value)
        ? 'Enter years of service as a whole number from 0 to 60.'
        : '';
    case 'employmentStatus':
      return value ? '' : 'Select your employment status.';
    case 'emergencyName':
      return value ? '' : 'Enter an emergency contact name.';
    case 'emergencyRelationship':
      return value ? '' : 'Enter how the emergency contact is related to you.';
    case 'emergencyPhone':
      if (!value) return "Enter the emergency contact's phone number.";
      return isValidPhone(value) ? '' : 'Enter a 10-digit U.S. phone number, like (205) 555-0100.';
    case 'emergencySecondaryPhone':
      return value && !isValidPhone(value)
        ? 'Enter a 10-digit backup phone number, or leave it blank.'
        : '';
    case 'goals':
      return value ? '' : 'Tell us what you hope to gain from this retreat.';
    case 'accuracyAgreement':
      return data.get(name) === 'on' ? '' : 'Confirm that your answers are accurate.';
    case 'contactConsent':
      return data.get(name) === 'on'
        ? ''
        : 'Consent to ALV storing this application and contacting you.';
    case 'placementAgreement':
      return data.get(name) === 'on'
        ? ''
        : 'Confirm that applying does not guarantee a retreat place.';
    case 'policyAgreement':
      return data.get(name) === 'on'
        ? ''
        : 'Agree to follow retreat policies provided by ALV staff.';
    case 'signature':
      if (!value) return 'Type your first and last name as your digital signature.';
      return signatureMatches(data.get('firstName'), data.get('lastName'), value)
        ? ''
        : "The digital signature must match the applicant's first and last name.";
    case 'signatureDate':
      if (!isValidCalendarDate(value)) return 'Enter a valid signature date.';
      return value > todayStamp() ? 'Signature date cannot be in the future.' : '';
    default:
      return '';
  }
}

export function formDataIncludingDisabled(form) {
  const disabled = [];
  for (const control of form.querySelectorAll('input, select, textarea')) {
    if (!control.disabled) continue;
    disabled.push(control);
    control.disabled = false;
  }
  const data = new FormData(form);
  for (const control of disabled) control.disabled = true;
  return data;
}

export function applicationPayloadFromFormData(
  data,
  { submissionId = '', consentTimestamp = '' } = {},
) {
  const applicantType = text(data, 'applicantType');
  const retreatType = text(data, 'retreatType');

  return {
    schemaVersion: APPLICATION_SCHEMA_VERSION,
    submissionId,
    retreat: {
      applicantType,
      retreatType,
      timingPreference: text(data, 'timingPreference'),
      enduranceEligible: text(data, 'enduranceEligible'),
    },
    applicant: {
      firstName: text(data, 'firstName'),
      lastName: text(data, 'lastName'),
      dateOfBirth: text(data, 'dateOfBirth'),
      gender: text(data, 'gender'),
      maritalStatus: text(data, 'maritalStatus'),
      dependents: text(data, 'dependents'),
      raceEthnicity: text(data, 'raceEthnicity'),
      householdIncome: text(data, 'householdIncome'),
      educationLevel: text(data, 'educationLevel'),
      email: text(data, 'email'),
      phone: formatPhoneNumber(text(data, 'phone')),
      address: {
        street: text(data, 'street'),
        city: text(data, 'city'),
        state: text(data, 'state'),
        postalCode: formatPostalCode(text(data, 'postalCode')),
        county: text(data, 'county'),
      },
      referral: {
        source: text(data, 'referralSource'),
        referredBy: text(data, 'referredBy'),
      },
      spouse:
        retreatType === 'marriage'
          ? {
              firstName: text(data, 'spouseFirstName'),
              lastName: text(data, 'spouseLastName'),
              email: text(data, 'spouseEmail'),
              phone: formatPhoneNumber(text(data, 'spousePhone')),
              dateOfBirth: text(data, 'spouseDateOfBirth'),
              gender: text(data, 'spouseGender'),
            }
          : null,
    },
    service:
      applicantType === 'military'
        ? {
            kind: 'military',
            branch: text(data, 'militaryBranch'),
            status: text(data, 'militaryStatus'),
            years: formatYears(text(data, 'militaryYears')),
            rank: text(data, 'militaryRank'),
            mos: text(data, 'militaryMos'),
            enteredService: text(data, 'serviceEntered'),
            separatedService: text(data, 'serviceSeparated'),
            dischargeType: text(data, 'dischargeType'),
            component: text(data, 'militaryComponent'),
            vaRating: text(data, 'vaRating'),
            vaCare: text(data, 'vaCare'),
            combatDeployment: text(data, 'combatDeployment'),
            combatTheaters: text(data, 'combatTheaters'),
            verificationStatus: 'staff-follow-up',
          }
        : {
            kind: 'first-responder',
            type: text(data, 'responderType'),
            agency: text(data, 'agency'),
            agencyLocation: text(data, 'agencyLocation'),
            status: text(data, 'responderStatus'),
            years: formatYears(text(data, 'responderYears')),
            rank: text(data, 'responderRank'),
            criticalIncident: text(data, 'criticalIncident'),
            verificationStatus: 'staff-follow-up',
          },
    workforce: {
      employmentStatus: text(data, 'employmentStatus'),
      employer: text(data, 'employer'),
      jobTitle: text(data, 'jobTitle'),
      industry: text(data, 'industry'),
      satisfaction: text(data, 'employmentSatisfaction'),
      challenge: text(data, 'employmentChallenge'),
      interests: values(data, 'workforceInterests'),
      notes: text(data, 'workforceNotes'),
    },
    finalDetails: {
      emergencyContact: {
        name: text(data, 'emergencyName'),
        relationship: text(data, 'emergencyRelationship'),
        phone: formatPhoneNumber(text(data, 'emergencyPhone')),
        secondaryPhone: formatPhoneNumber(text(data, 'emergencySecondaryPhone')),
      },
      previousRetreats: values(data, 'previousRetreats'),
      previousRetreatYears: text(data, 'previousRetreatYears'),
      goals: text(data, 'goals'),
      additionalNotes: text(data, 'additionalNotes'),
      agreements: {
        accuracy: checked(data, 'accuracyAgreement'),
        contact: checked(data, 'contactConsent'),
        placement: checked(data, 'placementAgreement'),
        policies: checked(data, 'policyAgreement'),
      },
      signature: text(data, 'signature'),
      signatureDate: text(data, 'signatureDate'),
    },
    consent: {
      version: CONSENT_VERSION,
      acceptedAt: consentTimestamp,
    },
  };
}

function humanize(value) {
  if (Array.isArray(value)) return value.length ? value.map(humanize).join(', ') : 'None selected';
  if (typeof value === 'boolean') return value ? 'Agreed' : 'Not agreed';
  const result = String(value || '').replace(/-/g, ' ');
  return result ? result.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not provided';
}

export function applicationReviewSections(payload) {
  const service = payload.service || {};
  return [
    {
      title: 'Retreat',
      rows: [
        ['Applicant type', humanize(payload.retreat?.applicantType)],
        ['Retreat requested', humanize(payload.retreat?.retreatType)],
        ['Timing', humanize(payload.retreat?.timingPreference)],
        ['Endurance eligibility', humanize(payload.retreat?.enduranceEligible)],
      ],
    },
    {
      title: 'Applicant',
      rows: [
        [
          'Name',
          `${payload.applicant?.firstName || ''} ${payload.applicant?.lastName || ''}`.trim(),
        ],
        ['Date of birth', payload.applicant?.dateOfBirth],
        ['Email', payload.applicant?.email],
        ['Phone', payload.applicant?.phone],
        [
          'Location',
          [
            payload.applicant?.address?.street,
            payload.applicant?.address?.city,
            payload.applicant?.address?.state,
            payload.applicant?.address?.postalCode,
            payload.applicant?.address?.county,
          ]
            .filter(Boolean)
            .join(', '),
        ],
        ['Referral source', humanize(payload.applicant?.referral?.source)],
        ['Referred by', payload.applicant?.referral?.referredBy],
        [
          'Spouse',
          payload.applicant?.spouse
            ? `${payload.applicant.spouse.firstName} ${payload.applicant.spouse.lastName}`.trim()
            : 'Not applicable',
        ],
      ],
    },
    {
      title: 'Service',
      rows:
        service.kind === 'military'
          ? [
              ['Service type', 'Military'],
              ['Branch', humanize(service.branch)],
              ['Status', humanize(service.status)],
              ['Years', service.years],
              ['Rank', service.rank],
              ['Combat-zone deployment', humanize(service.combatDeployment)],
            ]
          : [
              ['Service type', 'First responder'],
              ['First responder type', humanize(service.type)],
              ['Agency', service.agency],
              ['Status', humanize(service.status)],
              ['Years', service.years],
              ['Rank', service.rank],
              ['Critical incident', humanize(service.criticalIncident)],
            ],
    },
    {
      title: 'Workforce',
      rows: [
        ['Employment status', humanize(payload.workforce?.employmentStatus)],
        ['Employer', payload.workforce?.employer],
        ['Job title', payload.workforce?.jobTitle],
        ['Satisfaction', humanize(payload.workforce?.satisfaction)],
        ['Assistance interests', humanize(payload.workforce?.interests)],
        ['Goal notes', payload.workforce?.notes],
      ],
    },
    {
      title: 'Final details',
      rows: [
        ['Emergency contact', payload.finalDetails?.emergencyContact?.name],
        ['Relationship', payload.finalDetails?.emergencyContact?.relationship],
        ['Emergency phone', payload.finalDetails?.emergencyContact?.phone],
        ['Previous retreats', humanize(payload.finalDetails?.previousRetreats)],
        ['Years attended', payload.finalDetails?.previousRetreatYears],
        ['Retreat goals', payload.finalDetails?.goals],
        ['Additional notes', payload.finalDetails?.additionalNotes],
        ['Digital signature', payload.finalDetails?.signature],
        ['Signature date', payload.finalDetails?.signatureDate],
      ],
    },
  ].map((section) => ({
    ...section,
    rows: section.rows.map(([label, value]) => [label, humanize(value)]),
  }));
}

export function applicationReference(id) {
  return String(id || '').toUpperCase();
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('retreat-application-form');
  const status = document.getElementById('retreat-application-status');
  const previousButton = document.getElementById('retreat-previous');
  const nextButton = document.getElementById('retreat-next');
  const submitButton = document.getElementById('retreat-submit');
  const review = document.getElementById('retreat-application-review');
  const receipt = document.getElementById('retreat-application-receipt');
  const reference = document.getElementById('retreat-application-reference');
  const signatureError = document.getElementById('signature-error');
  const stepCounter = document.getElementById('retreat-step-counter');
  const apiUrl = window.__RETREAT_API_URL__;
  const steps = Array.from(document.querySelectorAll('[data-application-step]'));
  const progressSteps = Array.from(document.querySelectorAll('[data-progress-step]'));

  if (
    !(form instanceof HTMLFormElement) ||
    !(status instanceof HTMLElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(review instanceof HTMLElement) ||
    !(receipt instanceof HTMLElement) ||
    !(reference instanceof HTMLElement) ||
    !(signatureError instanceof HTMLElement) ||
    !steps.length ||
    !apiUrl
  ) {
    throw new Error('Retreat application form is not connected.');
  }

  form.noValidate = true;

  let currentStep = 0;
  const submissionId = crypto.randomUUID();

  function setPanelState(panel, visible) {
    panel.hidden = !visible;
    for (const control of panel.querySelectorAll('input, select, textarea')) {
      control.disabled = !visible;
    }
  }

  function syncConditionalFields() {
    const data = formDataIncludingDisabled(form);
    const applicantType = text(data, 'applicantType');
    const retreatType = text(data, 'retreatType');
    const referral = text(data, 'referralSource');
    const enduranceEligible = text(data, 'enduranceEligible');
    const serviceDog = text(data, 'serviceDog');
    for (const panel of form.querySelectorAll('[data-condition]')) {
      const condition = panel.getAttribute('data-condition');
      const visible =
        condition === applicantType ||
        condition === retreatType ||
        condition === referral ||
        (condition === 'service-dog-details' && serviceDog === 'bringing') ||
        (condition === 'endurance-ineligible' &&
          retreatType === 'endurance' &&
          enduranceEligible === 'no');
      setPanelState(panel, visible);
    }
  }

  function showStep(index, focusHeading = true) {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => {
      step.hidden = stepIndex !== currentStep;
    });
    progressSteps.forEach((item, stepIndex) => {
      if (stepIndex === currentStep) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.dataset.complete = String(stepIndex < currentStep);
      item.classList.toggle('current', stepIndex === currentStep);
      item.classList.toggle('done', stepIndex < currentStep);
    });
    previousButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === steps.length - 1;
    submitButton.hidden = currentStep !== steps.length - 1;
    if (stepCounter) {
      stepCounter.textContent = `Step ${currentStep + 1} of ${steps.length}`;
    }
    if (focusHeading) {
      setStatus('');
      const heading = steps[currentStep].querySelector('legend');
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(message) && isError);
  }

  function namedControl(name) {
    const named = form.elements.namedItem(name);
    if (named instanceof RadioNodeList) return named.item(0);
    return named instanceof HTMLElement ? named : null;
  }

  function errorHost(control) {
    return (
      control.closest(
        '.form-field, .form-group, .radio-stack, .check-grid, .mh-scale, .applicant-type-grid, .retreat-grid, .agreements, .scale-field',
      ) || control.parentElement
    );
  }

  function errorElementFor(control) {
    if (control.name === 'signature') return signatureError;
    const errorId = `${control.name}-error`;
    const existing = document.getElementById(errorId);
    if (existing) return existing;
    const message = document.createElement('p');
    message.className = 'field-error';
    message.id = errorId;
    message.hidden = true;
    message.setAttribute('role', 'alert');
    errorHost(control)?.append(message);
    return message;
  }

  function setFieldError(control, message) {
    if (!(control instanceof HTMLElement)) return;
    const group = [...form.elements].filter(
      (element) => element instanceof HTMLElement && element.name === control.name,
    );
    const error = errorElementFor(control);
    error.textContent = message;
    error.hidden = !message;
    const describedBy = new Set(
      String(control.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(Boolean),
    );
    if (message) describedBy.add(error.id);
    else describedBy.delete(error.id);
    for (const element of group) {
      element.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (describedBy.size) element.setAttribute('aria-describedby', [...describedBy].join(' '));
      else element.removeAttribute('aria-describedby');
    }
  }

  function applyFormat(control) {
    if (!(control instanceof HTMLInputElement) || control.disabled) return;
    const format = control.getAttribute('data-format') || (control.type === 'tel' ? 'phone' : '');
    if (format === 'phone') control.value = formatPhoneNumber(control.value);
    if (format === 'zip') control.value = formatPostalCode(control.value);
    if (format === 'years') control.value = formatYears(control.value);
  }

  function validateControl(control) {
    if (!(control instanceof HTMLElement) || !control.name || control.disabled) return true;
    const message = fieldIssue(control.name, formDataIncludingDisabled(form));
    setFieldError(control, message);
    if (control.name === 'signature') signatureError.hidden = !message;
    return !message;
  }

  function stepControls(step) {
    const seen = new Set();
    const controls = [];
    for (const control of step.querySelectorAll('input, select, textarea')) {
      if (control.disabled || !control.name || seen.has(control.name)) continue;
      seen.add(control.name);
      controls.push(control);
    }
    return controls;
  }

  function validateStep(stepIndex, { show = true } = {}) {
    syncConditionalFields();
    const step = steps[stepIndex];
    let firstInvalid = null;
    let firstMessage = '';
    for (const control of stepControls(step)) {
      const message = fieldIssue(control.name, formDataIncludingDisabled(form));
      if (show) setFieldError(control, message);
      if (message && !firstInvalid) {
        firstInvalid = control;
        firstMessage = message;
      }
    }
    if (firstInvalid && show) {
      firstInvalid.focus();
      setStatus(firstMessage, true);
      return false;
    }
    return !firstInvalid;
  }

  function validateCurrentStep() {
    return validateStep(currentStep);
  }

  function revealField(name, message) {
    const control = namedControl(name);
    if (!control) {
      setStatus(message, true);
      return;
    }
    const step = control.closest('[data-application-step]');
    const index = steps.indexOf(step);
    if (index >= 0) showStep(index, false);
    setFieldError(control, message);
    control.focus();
    control.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setStatus(message, true);
  }

  function validateAllSteps() {
    for (let index = 0; index < steps.length - 1; index += 1) {
      if (validateStep(index)) continue;
      return false;
    }
    return true;
  }

  function renderReview() {
    review.replaceChildren();
    const payload = applicationPayloadFromFormData(formDataIncludingDisabled(form), {
      submissionId,
    });
    for (const section of applicationReviewSections(payload)) {
      const container = document.createElement('section');
      container.className = 'review-section';
      const heading = document.createElement('h2');
      heading.textContent = section.title;
      const list = document.createElement('dl');
      for (const [label, value] of section.rows) {
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        list.append(term, detail);
      }
      container.append(heading, list);
      review.append(container);
    }
  }

  form.addEventListener('change', (event) => {
    syncConditionalFields();
    const target = event.target;
    if (target instanceof HTMLElement && target.name) validateControl(target);
  });
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    applyFormat(target);
    if (target.dataset.touched === 'true' || target.getAttribute('aria-invalid') === 'true') {
      validateControl(target);
    }
  });
  form.addEventListener(
    'blur',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.name) return;
      target.dataset.touched = 'true';
      applyFormat(target);
      validateControl(target);
    },
    true,
  );
  nextButton.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep === steps.length - 2) renderReview();
    showStep(currentStep + 1);
  });
  previousButton.addEventListener('click', () => showStep(currentStep - 1));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncConditionalFields();
    if (!validateAllSteps()) return;

    const payload = applicationPayloadFromFormData(formDataIncludingDisabled(form), {
      submissionId,
      consentTimestamp: new Date().toISOString(),
    });
    const abortController = new AbortController();
    const requestTimeout = Number(window.__RETREAT_REQUEST_TIMEOUT_MS__) || 20_000;
    const timeoutId = window.setTimeout(() => abortController.abort(), requestTimeout);
    submitButton.disabled = true;
    previousButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus('Securely sending your application…');

    try {
      const response = await fetch(`${apiUrl}/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) {
        const message =
          response.status === 400
            ? messageForApiError(result)
            : 'The application could not be sent. Your entries are still here; please try again.';
        if (response.status === 400 && result.field) revealField(result.field, message);
        else setStatus(message, true);
        return;
      }
      reference.textContent = applicationReference(result.id);
      form.hidden = true;
      document.querySelector('.form-header')?.setAttribute('hidden', '');
      document.querySelector('.progress-bar-wrap')?.setAttribute('hidden', '');
      document.querySelector('.application-progress')?.setAttribute('hidden', '');
      receipt.hidden = false;
      receipt.focus();
    } catch (error) {
      setStatus(
        error?.name === 'AbortError'
          ? 'The request timed out. Your entries are still here; please try again.'
          : 'The application service could not be reached. Your entries are still here; please try again.',
        true,
      );
    } finally {
      window.clearTimeout(timeoutId);
      submitButton.disabled = false;
      previousButton.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  syncConditionalFields();
  showStep(0, false);
}
