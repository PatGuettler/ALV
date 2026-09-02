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
      phone: text(data, 'phone'),
      address: {
        street: text(data, 'street'),
        city: text(data, 'city'),
        state: text(data, 'state'),
        postalCode: text(data, 'postalCode'),
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
              phone: text(data, 'spousePhone'),
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
            years: text(data, 'militaryYears'),
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
            years: text(data, 'responderYears'),
            rank: text(data, 'responderRank'),
            criticalIncident: text(data, 'criticalIncident'),
            departmentSupport: text(data, 'departmentSupport'),
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
    wellbeing: {
      phqHopeless: text(data, 'phqHopeless'),
      phqInterest: text(data, 'phqInterest'),
      anxietyFrequency: text(data, 'anxietyFrequency'),
      nightmares: text(data, 'nightmares'),
      mentalHealthOverall: text(data, 'mentalHealthOverall'),
      diagnoses: values(data, 'diagnoses'),
      inCare: text(data, 'inCare'),
      suicideHistory: text(data, 'suicideHistory'),
      crisisStatus: text(data, 'crisisStatus'),
      medicalConditions: text(data, 'medicalConditions'),
      medications: text(data, 'medications'),
      allergies: text(data, 'allergies'),
      mobility: text(data, 'mobility'),
      dietary: text(data, 'dietary'),
      serviceDog: text(data, 'serviceDog'),
      dog:
        text(data, 'serviceDog') === 'bringing'
          ? {
              name: text(data, 'dogName'),
              breed: text(data, 'dogBreed'),
              certification: text(data, 'dogCertification'),
              tasks: text(data, 'dogTasks'),
            }
          : null,
    },
    finalDetails: {
      emergencyContact: {
        name: text(data, 'emergencyName'),
        relationship: text(data, 'emergencyRelationship'),
        phone: text(data, 'emergencyPhone'),
        secondaryPhone: text(data, 'emergencySecondaryPhone'),
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
      title: 'Health and wellbeing',
      rows: [
        ['PHQ hopeless', payload.wellbeing?.phqHopeless],
        ['PHQ interest', payload.wellbeing?.phqInterest],
        ['Anxiety', payload.wellbeing?.anxietyFrequency],
        ['Nightmares / flashbacks', humanize(payload.wellbeing?.nightmares)],
        ['Overall mental health', payload.wellbeing?.mentalHealthOverall],
        ['Diagnoses', humanize(payload.wellbeing?.diagnoses)],
        ['In care', humanize(payload.wellbeing?.inCare)],
        ['Crisis status', humanize(payload.wellbeing?.crisisStatus)],
        ['Dietary', payload.wellbeing?.dietary],
        ['Service dog', humanize(payload.wellbeing?.serviceDog)],
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

  let currentStep = 0;
  const submissionId = crypto.randomUUID();

  function setPanelState(panel, visible) {
    panel.hidden = !visible;
    for (const control of panel.querySelectorAll('input, select, textarea')) {
      control.disabled = !visible;
    }
  }

  function syncConditionalFields() {
    const data = new FormData(form);
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
    status.textContent = '';
    if (focusHeading) {
      const heading = steps[currentStep].querySelector('legend');
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
  }

  function signatureIsValid() {
    const data = new FormData(form);
    const valid = signatureMatches(
      text(data, 'firstName'),
      text(data, 'lastName'),
      text(data, 'signature'),
    );
    signatureError.hidden = valid;
    return valid;
  }

  function validateCurrentStep() {
    syncConditionalFields();
    const invalid = steps[currentStep].querySelector(':invalid');
    if (invalid instanceof HTMLElement) {
      invalid.focus();
      if ('reportValidity' in invalid) invalid.reportValidity();
      status.textContent = 'Complete the required fields before continuing.';
      return false;
    }
    const data = new FormData(form);
    if (text(data, 'retreatType') === 'endurance' && text(data, 'enduranceEligible') === 'no') {
      status.textContent =
        "The Endurance Retreat requires a prior Men's or Women's Retreat. Choose another retreat to continue.";
      return false;
    }
    if (currentStep === steps.length - 2 && !signatureIsValid()) {
      const signature = form.elements.namedItem('signature');
      if (signature instanceof HTMLElement) signature.focus();
      status.textContent = 'Correct the digital signature before continuing.';
      return false;
    }
    return true;
  }

  function renderReview() {
    review.replaceChildren();
    const payload = applicationPayloadFromFormData(new FormData(form), { submissionId });
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

  form.addEventListener('change', syncConditionalFields);
  nextButton.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep === steps.length - 2) renderReview();
    showStep(currentStep + 1);
  });
  previousButton.addEventListener('click', () => showStep(currentStep - 1));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncConditionalFields();
    if (!form.checkValidity() || !signatureIsValid()) {
      status.textContent = 'Return to the earlier steps and correct the highlighted fields.';
      return;
    }

    const payload = applicationPayloadFromFormData(new FormData(form), {
      submissionId,
      consentTimestamp: new Date().toISOString(),
    });
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 20_000);
    submitButton.disabled = true;
    previousButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Securely sending your application…';

    try {
      const response = await fetch(`${apiUrl}/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) {
        status.textContent =
          response.status === 400
            ? 'The application contains an invalid answer. Review each step and try again.'
            : 'The application could not be sent. Your entries are still here; please try again.';
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
      status.textContent =
        error?.name === 'AbortError'
          ? 'The request timed out. Your entries are still here; please try again.'
          : 'The application service could not be reached. Your entries are still here; please try again.';
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
