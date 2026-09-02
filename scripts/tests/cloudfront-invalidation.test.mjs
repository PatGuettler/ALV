import assert from 'node:assert/strict';
import test from 'node:test';

import {
  invalidationPathsForKey,
  planCloudFrontInvalidation,
} from '../lib/cloudfront-invalidation.mjs';
import { evaluateProductionSmoke } from '../lib/production-smoke.mjs';

test('invalidationPathsForKey adds directory aliases only for HTML routes', () => {
  assert.deepEqual(invalidationPathsForKey('index.html').sort(), ['/', '/index.html']);
  assert.deepEqual(invalidationPathsForKey('about/index.html').sort(), [
    '/about',
    '/about/',
    '/about/index.html',
  ]);
  assert.deepEqual(invalidationPathsForKey('robots.txt'), ['/robots.txt']);
});

test('planCloudFrontInvalidation uses only mutable manifest objects', () => {
  const plan = planCloudFrontInvalidation({
    files: [
      { key: '_astro/SiteLayout.abc12345.css', immutable: true },
      { key: 'index.html', immutable: false },
      { key: 'resources/index.html', immutable: false },
      { key: 'robots.txt', immutable: false },
    ],
  });
  assert.deepEqual(plan.paths, [
    '/',
    '/index.html',
    '/resources',
    '/resources/',
    '/resources/index.html',
    '/robots.txt',
  ]);
  assert.equal(plan.quantity, 6);
});

test('planCloudFrontInvalidation rejects an unbounded batch', () => {
  assert.throws(
    () =>
      planCloudFrontInvalidation(
        {
          files: Array.from({ length: 3 }, (_, index) => ({
            key: `page-${index}/index.html`,
            immutable: false,
          })),
        },
        { maxPaths: 2 },
      ),
    /approved bound/,
  );
});

test('evaluateProductionSmoke accepts HTTPS, HTTP redirect, headers, navigation, and 988', () => {
  const failures = evaluateProductionSmoke({
    httpsHome: {
      status: 200,
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'",
      },
    },
    httpHome: { status: 301, location: 'https://alabamaveteran.org/' },
    routes: [
      {
        path: '/',
        status: 200,
        body: '<a href="/about/">About</a><a href="tel:988">988</a> Alabama Veteran',
      },
    ],
  });
  assert.deepEqual(failures, []);
});

test('evaluateProductionSmoke fails closed when headers or crisis link are missing', () => {
  const failures = evaluateProductionSmoke({
    httpsHome: { status: 200, headers: {} },
    httpHome: { status: 200, location: '' },
    routes: [{ path: '/', status: 200, body: 'Hello' }],
  });
  assert.ok(failures.some((item) => item.includes('HTTP home')));
  assert.ok(failures.some((item) => item.includes('strict-transport-security')));
  assert.ok(failures.some((item) => item.includes('988')));
});
