import assert from 'node:assert/strict';
import test from 'node:test';

import { contactMailtoHref } from '../../src/scripts/forms.js';
import { resourceCardMatches } from '../../src/scripts/resources.js';

test('contactMailtoHref encodes name, email, and message', () => {
  const href = contactMailtoHref({
    name: 'Pat Guettler',
    email: 'pat@example.com',
    message: 'Need help with a retreat.',
    contact: { email: 'info@alabamaveteran.org', subject: 'Website Contact from' },
  });
  const url = new URL(href);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'info@alabamaveteran.org');
  assert.equal(url.searchParams.get('subject'), 'Website Contact from Pat Guettler');
  assert.match(url.searchParams.get('body'), /From: Pat Guettler \(pat@example.com\)/);
  assert.match(url.searchParams.get('body'), /Need help with a retreat\./);
});

test('resourceCardMatches finds name, description, category, and type', () => {
  const card = {
    name: 'Veterans Crisis Line',
    desc: 'Free confidential support 24/7.',
    cat: 'crisis',
    type: 'hotline',
  };
  assert.equal(resourceCardMatches('', card), true);
  assert.equal(resourceCardMatches('crisis', card), true);
  assert.equal(resourceCardMatches('CONFIDENTIAL', card), true);
  assert.equal(resourceCardMatches('hotline', card), true);
  assert.equal(resourceCardMatches('housing', card), false);
});
