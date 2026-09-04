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

export function staffReference(id) {
  return String(id || '').toUpperCase();
}

export function formatStaffValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map(formatStaffValue).join(', ') : 'None selected';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value ?? '').trim();
  if (!text) return 'Not provided';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return staffReference(text);
  }
  if (text.includes('@') || /^\d{4}-\d{2}-\d{2}/.test(text) || /^\(\d{3}\)/.test(text)) return text;
  const labels = {
    mst: 'Military sexual trauma (MST)',
    ptsd: 'PTSD',
    tbi: 'TBI',
    'full-time': 'Employed full-time',
    'prefer-not-to-say': 'Prefer not to say',
    'prefer-not-to-answer': 'Prefer not to answer',
  };
  if (labels[text]) return labels[text];
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(text) && text === text.toLowerCase()) {
    return text.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return text;
}

export const humanize = formatStaffValue;

export const STAFF_LIST_STATUSES = ['submitted', 'approved', 'waitlisted', 'declined', 'cancelled'];

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
      !`${record.fullName || ''} ${record.email || ''} ${record.phone || ''} ${record.id || ''}`
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
        ['Reference number', staffReference(record.id)],
        ['Submitted', record.submittedAt],
        ['Applicant type', formatStaffValue(record.applicantType)],
        ['Retreat', formatStaffValue(record.retreatType)],
        ['Timing', formatStaffValue(record.retreat?.timingPreference)],
        ['Service verification', 'Staff follow-up required'],
      ],
    },
    {
      title: 'Applicant and contact',
      rows: [
        ['Name', record.fullName],
        ['Email', record.email],
        ['Phone', record.phone],
        ['Date of birth', applicant.dateOfBirth],
        ['Gender', applicant.gender],
        ['Marital status', applicant.maritalStatus],
        ['Dependents', applicant.dependents],
        ['Race / ethnicity', applicant.raceEthnicity],
        ['Household income', applicant.householdIncome],
        ['Education', applicant.educationLevel],
        ['Street', address.street],
        [
          'City / state / ZIP',
          [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
        ],
        ['County', address.county],
        ['Referral source', applicant.referral?.source],
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
              ['Branch', service.branch],
              ['Status', service.status],
              ['Years', service.years],
              ['Rank', service.rank],
              ['MOS / AFSC / rating', service.mos],
              ['Entered service', service.enteredService],
              ['Separated / ETS', service.separatedService],
              ['Discharge type', service.dischargeType],
              ['Component', service.component],
              ['VA disability rating', service.vaRating],
              ['VA care', service.vaCare],
              ['Combat-zone deployment', service.combatDeployment],
              ['Combat theaters', service.combatTheaters],
            ]
          : [
              ['Type', 'First responder'],
              ['Role', service.type],
              ['Agency', service.agency],
              ['Agency location', service.agencyLocation],
              ['Status', service.status],
              ['Years', service.years],
              ['Rank', service.rank],
              ['Critical incident', service.criticalIncident],
              ['Department support', service.departmentSupport],
            ],
    },
    {
      title: 'Workforce',
      rows: [
        ['Employment status', workforce.employmentStatus],
        ['Employer', workforce.employer],
        ['Job title', workforce.jobTitle],
        ['Industry', workforce.industry],
        ['Satisfaction', workforce.satisfaction],
        ['Employment challenge', workforce.challenge],
        ['Assistance interests', workforce.interests],
        ['Notes', workforce.notes],
      ],
    },
    {
      title: 'Final details',
      rows: [
        ['Emergency contact', emergency.name],
        ['Relationship', emergency.relationship],
        ['Emergency phone', emergency.phone],
        ['Backup phone', emergency.secondaryPhone],
        ['Previous retreats', finalDetails.previousRetreats],
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
    rows: section.rows.map(([label, value]) => [label, formatStaffValue(value)]),
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
  const dialogReference = document.getElementById('retreat-staff-dialog-reference');
  const detail = document.getElementById('retreat-staff-detail');
  const decisionStatus = document.getElementById('retreat-staff-decision-status');
  const note = document.getElementById('retreat-staff-note');
  const saveButton = document.getElementById('retreat-staff-save');
  const closeButton = document.getElementById('retreat-staff-close');
  const dialogStatus = document.getElementById('retreat-staff-dialog-status');
  const usersPanel = document.getElementById('retreat-staff-users');
  const usersStatus = document.getElementById('retreat-staff-users-status');
  const userItems = document.getElementById('retreat-staff-user-items');
  const inviteForm = document.getElementById('retreat-staff-invite-form');
  const inviteEmail = document.getElementById('retreat-staff-invite-email');
  const inviteButton = document.getElementById('retreat-staff-invite');

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
    !(dialogReference instanceof HTMLElement) ||
    !(detail instanceof HTMLElement) ||
    !(decisionStatus instanceof HTMLSelectElement) ||
    !(note instanceof HTMLTextAreaElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    !(dialogStatus instanceof HTMLElement) ||
    !(usersPanel instanceof HTMLElement) ||
    !(usersStatus instanceof HTMLElement) ||
    !(userItems instanceof HTMLElement) ||
    !(inviteForm instanceof HTMLFormElement) ||
    !(inviteEmail instanceof HTMLInputElement) ||
    !(inviteButton instanceof HTMLButtonElement)
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
      const tokens = JSON.parse(sessionStorage.getItem(tokenKey) || 'null');
      if (!tokens?.access_token) return null;
      const lifetimeMs = Number(tokens.expires_in || 3600) * 1000;
      const storedAt = Number(tokens.storedAt || 0);
      if (storedAt && Date.now() > storedAt + lifetimeMs) {
        clearSession();
        return null;
      }
      return tokens;
    } catch {
      return null;
    }
  }

  function writeTokens(tokens) {
    sessionStorage.setItem(tokenKey, JSON.stringify({ ...tokens, storedAt: Date.now() }));
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
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearSession();
      throw new Error('signed_out');
    }
    if (!response.ok) {
      const code = body.error || (response.status === 409 ? 'version_conflict' : 'api_error');
      const error = new Error(code);
      error.status = response.status;
      throw error;
    }
    return body;
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
      cell.colSpan = 9;
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

      const reference = document.createElement('td');
      reference.className = 'table-sub';
      reference.textContent = staffReference(record.id);

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
      button.className = 'action-btn';
      button.textContent = 'View';
      button.addEventListener('click', () => openApplication(record.id));
      actions.append(button);

      row.append(applicant, reference, type, retreat, timing, statusCell, past, applied, actions);
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
    dialogReference.textContent = `Reference ${staffReference(record.id)}`;
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

  function staffAccessLabel(user) {
    if (!user.enabled) return 'Revoked';
    if (user.status === 'FORCE_CHANGE_PASSWORD' || user.status === 'RESET_REQUIRED') {
      return 'Invite sent';
    }
    return 'Active';
  }

  function staffAccessBadgeClass(user) {
    if (!user.enabled) return 'badge-denied';
    if (user.status === 'FORCE_CHANGE_PASSWORD' || user.status === 'RESET_REQUIRED') {
      return 'badge-pending';
    }
    return 'badge-approved';
  }

  function userActionMessage(code) {
    return (
      {
        invalid_email: 'Enter a valid email address.',
        user_exists: 'That email already has a staff account.',
        protected_user: 'Super admin accounts cannot be changed here.',
        forbidden: 'Only super admins can manage staff access.',
        signed_out: 'Session expired. Sign in again.',
      }[code] || 'Staff access could not be updated. Try again.'
    );
  }

  function renderUsers(users) {
    userItems.replaceChildren();
    if (!users.length) {
      const empty = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'No staff accounts yet.';
      empty.append(cell);
      userItems.append(empty);
      return;
    }
    for (const user of users) {
      const row = document.createElement('tr');
      const member = document.createElement('td');
      const email = document.createElement('strong');
      email.textContent = user.email || user.username || 'Unknown user';
      member.append(email);

      const role = document.createElement('td');
      const roleBadge = document.createElement('span');
      roleBadge.className = `badge ${user.protected ? 'badge-waitlist' : 'badge-fr'}`;
      roleBadge.textContent = user.protected ? 'Super admin' : 'Reviewer';
      role.append(roleBadge);

      const access = document.createElement('td');
      const accessBadge = document.createElement('span');
      accessBadge.className = `badge ${staffAccessBadgeClass(user)}`;
      accessBadge.textContent = staffAccessLabel(user);
      access.append(accessBadge);

      const actions = document.createElement('td');
      if (user.protected) {
        const locked = document.createElement('span');
        locked.className = 'table-sub';
        locked.textContent = 'Protected';
        actions.append(locked);
      } else {
        const group = document.createElement('div');
        group.className = 'staff-user-actions';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'action-btn';
        toggle.textContent = user.enabled ? 'Revoke' : 'Restore';
        toggle.addEventListener('click', () => {
          setUserEnabled(user, !user.enabled);
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'action-btn action-btn-danger';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => {
          deleteUser(user);
        });
        group.append(toggle, remove);
        actions.append(group);
      }

      row.append(member, role, access, actions);
      userItems.append(row);
    }
  }

  async function loadUsers() {
    usersStatus.textContent = 'Loading staff accounts…';
    const payload = await api('/v1/staff/users');
    renderUsers(payload.items || []);
    usersStatus.textContent = '';
  }

  async function loadMe() {
    try {
      return await api('/v1/staff/me');
    } catch (error) {
      if (error.status === 404) return { role: 'reviewer' };
      throw error;
    }
  }

  async function afterSignIn() {
    showSignedIn();
    const me = await loadMe();
    usersPanel.hidden = me.role !== 'super-admin';
    await loadList();
    if (me.role === 'super-admin') {
      try {
        await loadUsers();
      } catch (error) {
        usersStatus.textContent = userActionMessage(error.message);
      }
    }
  }

  async function inviteUser(event) {
    event.preventDefault();
    inviteButton.disabled = true;
    usersStatus.textContent = 'Sending invite…';
    try {
      const created = await api('/v1/staff/users', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.value.trim() }),
      });
      inviteForm.reset();
      usersStatus.textContent = created.resent
        ? 'Invite resent. They will set a password and enroll MFA on first sign-in.'
        : 'Invite sent. They will set a password and enroll MFA on first sign-in.';
      await loadUsers();
    } catch (error) {
      usersStatus.textContent = userActionMessage(error.message);
      if (error.message === 'signed_out') showSignedOut('Session expired. Sign in again.');
    } finally {
      inviteButton.disabled = false;
    }
  }

  async function setUserEnabled(user, enabled) {
    if (
      !enabled &&
      !window.confirm(`Revoke access for ${user.email}? They will not be able to sign in.`)
    ) {
      return;
    }
    usersStatus.textContent = enabled ? 'Restoring access…' : 'Revoking access…';
    try {
      await api(`/v1/staff/users/${encodeURIComponent(user.username)}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      usersStatus.textContent = enabled ? 'Access restored.' : 'Access revoked.';
      await loadUsers();
    } catch (error) {
      usersStatus.textContent = userActionMessage(error.message);
      if (error.message === 'signed_out') showSignedOut('Session expired. Sign in again.');
    }
  }

  async function deleteUser(user) {
    if (
      !window.confirm(
        `Delete ${user.email} from the staff portal? They will need a new invite to sign in again.`,
      )
    ) {
      return;
    }
    usersStatus.textContent = 'Removing staff account…';
    try {
      await api(`/v1/staff/users/${encodeURIComponent(user.username)}`, { method: 'DELETE' });
      usersStatus.textContent = 'Staff account removed.';
      await loadUsers();
    } catch (error) {
      usersStatus.textContent = userActionMessage(error.message);
      if (error.message === 'signed_out') showSignedOut('Session expired. Sign in again.');
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
    usersPanel.hidden = true;
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
  inviteForm.addEventListener('submit', inviteUser);

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const loginError = params.get('error');

  if (loginError) {
    showSignedOut('Sign-in was cancelled or failed.');
  } else if (code) {
    exchangeCode(code)
      .then(() => afterSignIn())
      .catch(() => showSignedOut('Sign-in could not be completed. Try again.'));
  } else if (readTokens()?.access_token) {
    afterSignIn().catch(() => showSignedOut('Session expired. Sign in again.'));
  } else {
    showSignedOut('');
  }
}
