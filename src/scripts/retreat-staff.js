const config = window.__RETREAT_STAFF__;
const signInButton = document.getElementById('retreat-staff-signin');
const signOutButton = document.getElementById('retreat-staff-signout');
const status = document.getElementById('retreat-staff-status');
const list = document.getElementById('retreat-staff-list');
const items = document.getElementById('retreat-staff-items');
const filter = document.getElementById('retreat-staff-status-filter');

if (
  !config?.apiUrl ||
  !(signInButton instanceof HTMLButtonElement) ||
  !(signOutButton instanceof HTMLButtonElement) ||
  !(status instanceof HTMLElement) ||
  !(list instanceof HTMLElement) ||
  !(items instanceof HTMLElement) ||
  !(filter instanceof HTMLSelectElement)
) {
  throw new Error('Retreat staff page is not connected.');
}

const redirectUri = new URL('warrior-retreat-staff/', `${window.location.origin}${config.base}`)
  .href;
const tokenKey = 'alv-retreat-tokens';
const verifierKey = 'alv-retreat-pkce';

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
  const url = new URL('/oauth2/authorize', config.cognitoDomain);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  window.location.assign(url.href);
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
  const tokens = await response.json();
  writeTokens(tokens);
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
  if (!response.ok) throw new Error('api_error');
  return response.json();
}

function renderItems(records) {
  items.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No applications in this status.';
    items.append(empty);
    return;
  }
  for (const record of records) {
    const item = document.createElement('li');
    item.className = 'retreat-staff-card';
    const title = document.createElement('strong');
    title.textContent = record.fullName;
    const meta = document.createElement('p');
    meta.textContent = `${record.email} · ${record.program || 'unspecified'} · ${record.submittedAt}`;
    const message = document.createElement('p');
    message.textContent = record.message || 'No additional note.';
    item.append(title, meta, message);
    if (record.status === 'submitted') {
      const actions = document.createElement('div');
      actions.className = 'retreat-staff-actions';
      for (const next of ['approved', 'declined']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = next === 'approved' ? 'Approve' : 'Decline';
        button.addEventListener('click', () => updateStatus(record.id, next));
        actions.append(button);
      }
      item.append(actions);
    }
    items.append(item);
  }
}

async function loadList() {
  status.textContent = 'Loading applications…';
  const payload = await api(`/v1/staff/applications?status=${encodeURIComponent(filter.value)}`);
  renderItems(payload.items || []);
  status.textContent = '';
}

async function updateStatus(id, nextStatus) {
  status.textContent = 'Saving…';
  await api(`/v1/staff/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: nextStatus }),
  });
  await loadList();
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
filter.addEventListener('change', () => {
  loadList().catch(() => {
    showSignedOut('Session expired. Sign in again.');
  });
});

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
    .catch(() => {
      showSignedOut('Sign-in could not be completed. Try again.');
    });
} else if (readTokens()?.access_token) {
  showSignedIn();
  loadList().catch(() => {
    showSignedOut('Session expired. Sign in again.');
  });
} else {
  showSignedOut('');
}
