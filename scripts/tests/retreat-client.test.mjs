import assert from 'node:assert/strict';
import test from 'node:test';

import { applicationPayloadFromFormData } from '../../src/scripts/retreat-application.js';
import { staffAuthorizeUrl, staffRedirectUri } from '../../src/scripts/retreat-staff.js';

test('applicationPayloadFromFormData copies fields and maps consent', () => {
  const data = new FormData();
  data.set('fullName', 'Pat Guettler');
  data.set('email', 'pat@example.com');
  data.set('phone', '555-0100');
  data.set('program', 'warrior-retreat');
  data.set('message', 'Need a weekend.');
  data.set('consent', 'on');

  assert.deepEqual(applicationPayloadFromFormData(data), {
    fullName: 'Pat Guettler',
    email: 'pat@example.com',
    phone: '555-0100',
    program: 'warrior-retreat',
    message: 'Need a weekend.',
    consent: true,
  });
});

test('applicationPayloadFromFormData treats missing consent as false', () => {
  const data = new FormData();
  data.set('fullName', 'Pat');
  assert.equal(applicationPayloadFromFormData(data).consent, false);
  assert.equal(applicationPayloadFromFormData(data).email, '');
});

test('staffRedirectUri keeps the GitHub Pages repo path', () => {
  assert.equal(
    staffRedirectUri('https://patguettler.github.io', '/ALV/'),
    'https://patguettler.github.io/ALV/warrior-retreat-staff/',
  );
  assert.equal(
    staffRedirectUri('https://patguettler.github.io', '/ALV'),
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
  assert.equal(
    url.origin,
    'https://alv-prod-retreat-286801153738.auth.us-east-1.amazoncognito.com',
  );
  assert.equal(url.pathname, '/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), '37tsmb3p4du202e1vmstblsrui');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'https://patguettler.github.io/ALV/warrior-retreat-staff/',
  );
  assert.equal(url.searchParams.get('code_challenge'), 'abc');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});
