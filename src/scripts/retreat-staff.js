export function staffRedirectUri(origin, base) {
  const prefix = String(base || '/');
  const withLeading = prefix.startsWith('/') ? prefix : `/${prefix}`;
  const withSlash = withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  return new URL('warrior-retreat-staff/', `${origin}${withSlash}`).href;
}

export function staffAuthorizeUrl({ cognitoDomain, clientId, redirectUri, challenge }) {
  const url = new URL('/oauth2/authorize', cognitoDomain);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.href;
}

export const STAFF_LIST_STATUSES = ['submitted', 'approved', 'waitlisted', 'declined', 'cancelled'];

export function humanize(value) {
  if (Array.isArray(value)) return value.length ? value.map(humanize).join(', ') : 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const result = String(value || '').replace(/-/g, ' ');
  return result ? result.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not provided';
}

export function staffDashboardStats(records) {
  return {
    total: records.length,
    submitted: records.filter((record) => record.status === 'submitted').length,
    approved: records.filter((record) => record.status === 'approved').length,
    returning: records.filter(
      (record) => Array.isArray(record.previousRetreats) && record.previousRetreats.length > 0,
    ).length,
  };
}

export function filterStaffRecords(records, filters = {}) {
  const term = String(filters.query || '')
    .toLocaleLowerCase('en-US')
    .trim();
  return records.filter((record) => {
    if (filters.retreatType && record.retreatType !== filters.retreatType) return false;
    if (filters.status && record.status !== filters.status) return false;
    if (filters.applicantType && record.applicantType !== filters.applicantType) return false;
    if (
      term &&
      !`${record.fullName || ''} ${record.email || ''} ${record.phone || ''}`
        .toLocaleLowerCase('en-US')
        .includes(term)
    ) {
      return false;
    }
    return true;
  });
}

export function statusBadgeClass(status) {
  return (
    {
      submitted: 'badge-pending',
      approved: 'badge-approved',
      waitlisted: 'badge-waitlist',
      declined: 'badge-denied',
      cancelled: 'badge-cancelled',
    }[status] || 'badge-waitlist'
  );
}

export function staffDetailSections(record) {
  const applicant = record.applicant || {};
  const address = applicant.address || {};
  const service = record.service || {};
  const workforce = record.workforce || {};
  const finalDetails = record.finalDetails || {};
  const emergency = finalDetails.emergencyContact || {};
  return [
    {
      title: 'Application',
      rows: [
        ['Reference', record.id],
        ['Submitted', record.submittedAt],
        ['Applicant type', humanize(record.applicantType)],
        ['Retreat', humanize(record.retreatType)],
        ['Timing', humanize(record.retreat?.timingPreference)],
        ['Service verification', 'Staff follow-up required'],
      ],
    },
    {
      title: 'Applicant and contact',
      rows: [
        ['Name', record.fullName],
        ['Email', record.email],
        ['Phone', record.phone],
        ['Street', address.street],
        [
          'City / state / ZIP',
          [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
        ],
        ['County', address.county],
        ['Referral source', humanize(applicant.referral?.source)],
        ['Date of birth', applicant.dateOfBirth],
        ['Referred by', applicant.referral?.referredBy],
        [
          'Spouse',
          applicant.spouse
            ? `${applicant.spouse.firstName || ''} ${applicant.spouse.lastName || ''}`.trim()
            : 'Not applicable',
        ],
      ],
    },
    {
      title: 'Service history',
      rows:
        service.kind === 'military'
          ? [
              ['Type', 'Military'],
              ['Branch', humanize(service.branch)],
              ['Status', humanize(service.status)],
              ['Years', service.years],
              ['Rank', service.rank],
              ['Combat-zone deployment', humanize(service.combatDeployment)],
            ]
          : [
              ['Type', 'First responder'],
              ['Role', humanize(service.type)],
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
        ['Employment status', humanize(workforce.employmentStatus)],
        ['Employer', workforce.employer],
        ['Job title', workforce.jobTitle],
        ['Satisfaction', humanize(workforce.satisfaction)],
        ['Assistance interests', humanize(workforce.interests)],
        ['Notes', workforce.notes],
      ],
    },
    {
      title: 'Health and wellbeing',
      rows: [
        ['PHQ hopeless', record.wellbeing?.phqHopeless],
        ['PHQ interest', record.wellbeing?.phqInterest],
        ['Anxiety', record.wellbeing?.anxietyFrequency],
        ['Nightmares / flashbacks', record.wellbeing?.nightmares],
        ['Overall mental health', record.wellbeing?.mentalHealthOverall],
        ['Diagnoses', record.wellbeing?.diagnoses],
        ['In care', record.wellbeing?.inCare],
        ['Suicide history', record.wellbeing?.suicideHistory],
        ['Crisis status', record.wellbeing?.crisisStatus],
        ['Medical conditions', record.wellbeing?.medicalConditions],
        ['Medications', record.wellbeing?.medications],
        ['Allergies', record.wellbeing?.allergies],
        ['Mobility', record.wellbeing?.mobility],
        ['Dietary', record.wellbeing?.dietary],
        ['Service dog', record.wellbeing?.serviceDog],
      ],
    },
    {
      title: 'Final details',
      rows: [
        ['Emergency contact', emergency.name],
        ['Relationship', emergency.relationship],
        ['Emergency phone', emergency.phone],
        ['Previous retreats', humanize(finalDetails.previousRetreats)],
        ['Years attended', finalDetails.previousRetreatYears],
        ['Goals', finalDetails.goals],
        ['Additional notes', finalDetails.additionalNotes],
        ['Signature', finalDetails.signature],
        ['Signature date', finalDetails.signatureDate],
        ['Consent version', record.consent?.version],
      ],
    },
  ].map((section) => ({
    ...section,
    rows: section.rows.map(([label, value]) => [label, humanize(value)]),
  }));
}

if (typeof document !== 'undefined') {
  const config = window.__RETREAT_STAFF__;
  const signInButton = document.getElementById('retreat-staff-signin');
  const signOutButton = document.getElementById('retreat-staff-signout');
  const status = document.getElementById('retreat-staff-status');
  const list = document.getElementById('retreat-staff-list');
  const items = document.getElementById('retreat-staff-items');
  const filter = document.getElementById('retreat-staff-status-filter');
  const retreatFilter = document.getElementById('retreat-staff-retreat-filter');
  const typeFilter = document.getElementById('retreat-staff-type-filter');
  const search = document.getElementById('retreat-staff-search');
  const statTotal = document.getElementById('retreat-stat-total');
  const statSubmitted = document.getElementById('retreat-stat-submitted');
  const statApproved = document.getElementById('retreat-stat-approved');
  const statReturning = document.getElementById('retreat-stat-returning');
  const dialog = document.getElementById('retreat-staff-dialog');
  const dialogTitle = document.getElementById('retreat-staff-dialog-title');
  const detail = document.getElementById('retreat-staff-detail');
  const decisionStatus = document.getElementById('retreat-staff-decision-status');
  const note = document.getElementById('retreat-staff-note');
  const saveButton = document.getElementById('retreat-staff-save');
  const closeButton = document.getElementById('retreat-staff-close');
  const dialogStatus = document.getElementById('retreat-staff-dialog-status');

  if (
    !config?.apiUrl ||
    !(signInButton instanceof HTMLButtonElement) ||
    !(signOutButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement) ||
    !(list instanceof HTMLElement) ||
    !(items instanceof HTMLElement) ||
    !(filter instanceof HTMLSelectElement) ||
    !(retreatFilter instanceof HTMLSelectElement) ||
    !(typeFilter instanceof HTMLSelectElement) ||
    !(search instanceof HTMLInputElement) ||
    !(statTotal instanceof HTMLElement) ||
    !(statSubmitted instanceof HTMLElement) ||
    !(statApproved instanceof HTMLElement) ||
    !(statReturning instanceof HTMLElement) ||
    !(dialog instanceof HTMLDialogElement) ||
    !(dialogTitle instanceof HTMLElement) ||
    !(detail instanceof HTMLElement) ||
    !(decisionStatus instanceof HTMLSelectElement) ||
    !(note instanceof HTMLTextAreaElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    !(dialogStatus instanceof HTMLElement)
  ) {
    throw new Error('Retreat staff page is not connected.');
  }

  const redirectUri = staffRedirectUri(window.location.origin, config.base);
  const tokenKey = 'alv-retreat-tokens';
  const verifierKey = 'alv-retreat-pkce';
  let records = [];
  let selectedRecord = null;

  function randomVerifier() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async function challengeFrom(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function readTokens() {
    try {
      return JSON.parse(sessionStorage.getItem(tokenKey) || 'null');
    } catch {
      return null;
    }
  }

  function writeTokens(tokens) {
    sessionStorage.setItem(tokenKey, JSON.stringify(tokens));
  }

  function clearSession() {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(verifierKey);
  }

  async function startLogin() {
    const verifier = randomVerifier();
    sessionStorage.setItem(verifierKey, verifier);
    const challenge = await challengeFrom(verifier);
    window.location.assign(
      staffAuthorizeUrl({
        cognitoDomain: config.cognitoDomain,
        clientId: config.clientId,
        redirectUri,
        challenge,
      }),
    );
  }

  function startLogout() {
    clearSession();
    const url = new URL('/logout', config.cognitoDomain);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('logout_uri', redirectUri);
    window.location.assign(url.href);
  }

  async function exchangeCode(code) {
    const verifier = sessionStorage.getItem(verifierKey);
    if (!verifier) throw new Error('missing_verifier');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const response = await fetch(new URL('/oauth2/token', config.cognitoDomain), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error('token_exchange_failed');
    writeTokens(await response.json());
    sessionStorage.removeItem(verifierKey);
    window.history.replaceState({}, document.title, redirectUri);
  }

  async function api(path, options = {}) {
    const tokens = readTokens();
    if (!tokens?.access_token) throw new Error('signed_out');
    const response = await fetch(`${config.apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      clearSession();
      throw new Error('signed_out');
    }
    if (!response.ok) {
      const error = new Error(response.status === 409 ? 'version_conflict' : 'api_error');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function currentFilters() {
    return {
      retreatType: retreatFilter.value,
      status: filter.value,
      applicantType: typeFilter.value,
      query: search.value,
    };
  }

  function renderStats() {
    const stats = staffDashboardStats(records);
    statTotal.textContent = String(stats.total);
    statSubmitted.textContent = String(stats.submitted);
    statApproved.textContent = String(stats.approved);
    statReturning.textContent = String(stats.returning);
  }

  function renderItems() {
    items.replaceChildren();
    const visible = filterStaffRecords(records, currentFilters());
    if (!visible.length) {
      const empty = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.textContent = search.value.trim()
        ? 'No applications match this search.'
        : 'No applications in this view.';
      empty.append(cell);
      items.append(empty);
      return;
    }
    for (const record of visible) {
      const row = document.createElement('tr');
      const applicant = document.createElement('td');
      const name = document.createElement('strong');
      name.textContent = record.fullName || 'Unnamed applicant';
      const email = document.createElement('div');
      email.className = 'table-sub';
      email.textContent = record.email || '';
      applicant.append(name, email);

      const type = document.createElement('td');
      type.textContent = humanize(record.applicantType);

      const retreat = document.createElement('td');
      const retreatBadge = document.createElement('span');
      retreatBadge.className = `badge badge-${record.retreatType || 'mens'}`;
      retreatBadge.textContent = humanize(record.retreatType);
      retreat.append(retreatBadge);

      const timing = document.createElement('td');
      timing.textContent = humanize(record.timingPreference);

      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = `badge ${statusBadgeClass(record.status)}`;
      statusBadge.textContent = humanize(record.status);
      statusCell.append(statusBadge);

      const past = document.createElement('td');
      past.textContent = humanize(record.previousRetreats);

      const applied = document.createElement('td');
      applied.textContent = record.submittedAt
        ? new Date(record.submittedAt).toLocaleDateString()
        : 'Not provided';

      const actions = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'View';
      button.addEventListener('click', () => openApplication(record.id));
      actions.append(button);

      row.append(applicant, type, retreat, timing, statusCell, past, applied, actions);
      items.append(row);
    }
  }

  function renderDetail(record) {
    detail.replaceChildren();
    for (const section of staffDetailSections(record)) {
      const container = document.createElement('section');
      container.className = 'review-section';
      const heading = document.createElement('h3');
      heading.textContent = section.title;
      const list = document.createElement('dl');
      for (const [label, value] of section.rows) {
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        list.append(term, description);
      }
      container.append(heading, list);
      detail.append(container);
    }
  }

  async function openApplication(id) {
    status.textContent = 'Loading application…';
    const record = await api(`/v1/staff/applications/${encodeURIComponent(id)}`);
    selectedRecord = record;
    dialogTitle.textContent = record.fullName || 'Application';
    decisionStatus.value = record.status;
    note.value = record.note || '';
    dialogStatus.textContent = '';
    renderDetail(record);
    dialog.showModal();
    status.textContent = '';
  }

  async function loadList() {
    status.textContent = 'Loading applications…';
    const pages = await Promise.all(
      STAFF_LIST_STATUSES.map((nextStatus) =>
        api(`/v1/staff/applications?status=${encodeURIComponent(nextStatus)}`),
      ),
    );
    records = pages.flatMap((payload) => payload.items || []);
    renderStats();
    renderItems();
    status.textContent = '';
  }

  async function saveDecision() {
    if (!selectedRecord) return;
    saveButton.disabled = true;
    dialogStatus.textContent = 'Saving decision…';
    try {
      selectedRecord = await api(
        `/v1/staff/applications/${encodeURIComponent(selectedRecord.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: decisionStatus.value,
            note: note.value,
            expectedVersion: selectedRecord.version,
          }),
        },
      );
      dialog.close();
      await loadList();
    } catch (error) {
      dialogStatus.textContent =
        error?.message === 'version_conflict'
          ? 'Another staff member changed this application. Close and reopen it before saving.'
          : 'The decision could not be saved. Try again.';
    } finally {
      saveButton.disabled = false;
    }
  }

  function showSignedIn() {
    signInButton.hidden = true;
    signOutButton.hidden = false;
    list.hidden = false;
  }

  function showSignedOut(message) {
    signInButton.hidden = false;
    signOutButton.hidden = true;
    list.hidden = true;
    status.textContent = message;
  }

  signInButton.addEventListener('click', () => {
    startLogin().catch(() => {
      status.textContent = 'Sign-in could not start.';
    });
  });
  signOutButton.addEventListener('click', startLogout);
  filter.addEventListener('change', renderItems);
  retreatFilter.addEventListener('change', renderItems);
  typeFilter.addEventListener('change', renderItems);
  search.addEventListener('input', renderItems);
  saveButton.addEventListener('click', saveDecision);
  closeButton.addEventListener('click', () => dialog.close());

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const loginError = params.get('error');

  if (loginError) {
    showSignedOut('Sign-in was cancelled or failed.');
  } else if (code) {
    exchangeCode(code)
      .then(() => {
        showSignedIn();
        return loadList();
      })
      .catch(() => showSignedOut('Sign-in could not be completed. Try again.'));
  } else if (readTokens()?.access_token) {
    showSignedIn();
    loadList().catch(() => showSignedOut('Session expired. Sign in again.'));
  } else {
    showSignedOut('');
  }
}
