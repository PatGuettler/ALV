import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLinkCheckReport,
  classifyLinkCheck,
  registrableDomain,
} from '../lib/resource-link-check.mjs';
import { publicResourceLinks } from '../../src/scripts/resources.js';

test('registrableDomain treats www and apex as the same owner', () => {
  assert.equal(registrableDomain('www.va.gov'), 'va.gov');
  assert.equal(registrableDomain('va.gov'), 'va.gov');
});

test('classifyLinkCheck records healthy, redirected, broken, timed-out, and recovered flags', () => {
  assert.deepEqual(
    classifyLinkCheck({
      url: 'https://veteranscrisisline.net/',
      hops: [{ url: 'https://veteranscrisisline.net/', status: 200 }],
    }).flags,
    ['healthy'],
  );
  assert.deepEqual(
    classifyLinkCheck({
      url: 'https://www.va.gov/health',
      hops: [
        { url: 'https://www.va.gov/health', status: 301 },
        { url: 'https://www.va.gov/health-care', status: 200 },
      ],
    }).flags,
    ['redirected'],
  );
  assert.deepEqual(
    classifyLinkCheck({
      url: 'https://mh.alabama.gov/',
      hops: [{ url: 'https://mh.alabama.gov/', status: 404 }],
    }).flags,
    ['broken'],
  );
  assert.deepEqual(classifyLinkCheck({ url: 'https://giveanhour.org/', error: 'timeout' }).flags, [
    'timed_out',
  ]);
  assert.deepEqual(
    classifyLinkCheck({
      url: 'https://centerstone.org/',
      hops: [{ url: 'https://centerstone.org/', status: 200 }],
      previousStatus: 'broken',
    }).flags,
    ['healthy', 'recovered'],
  );
});

test('classifyLinkCheck flags owner-changing redirects without rewriting public content', () => {
  const result = classifyLinkCheck({
    url: 'https://veteranscrisisline.net/',
    hops: [
      { url: 'https://veteranscrisisline.net/', status: 302 },
      { url: 'https://unexpected-ads.example/', status: 200 },
    ],
  });
  assert.deepEqual(result.flags, ['suspicious_redirect', 'content_owner_change']);
  const report = buildLinkCheckReport([result]);
  assert.equal(report.publicContentChanged, false);
  assert.equal(report.totals.suspicious, 1);
});

test('publicResourceLinks expose directory URLs without mutating the catalog', () => {
  const links = publicResourceLinks();
  assert.equal(
    links.some((item) => item.url === 'https://veteranscrisisline.net'),
    true,
  );
  assert.equal(
    links.every((item) => item.url.startsWith('https://') || item.url.startsWith('http://')),
    true,
  );
});

test('checkResourceLinks records flags from a mocked transport and never rewrites the catalog', async () => {
  const { checkResourceLinks } = await import('../resource-link-check.mjs');
  const responses = {
    'https://veteranscrisisline.net/': { status: 200 },
    'https://mh.alabama.gov/': { status: 301, location: 'https://other.example/' },
    'https://other.example/': { status: 200 },
    'https://giveanhour.org/': { status: 404 },
  };
  const fetchImpl = async (url, { signal } = {}) => {
    if (url === 'https://centerstone.org/') {
      signal?.throwIfAborted?.();
      await new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
    const mapped = responses[url];
    if (!mapped) throw new Error(`unexpected ${url}`);
    return {
      status: mapped.status,
      headers: { get: (name) => (name === 'location' ? mapped.location : null) },
    };
  };
  const report = await checkResourceLinks(
    [
      { id: 1, name: 'Crisis', cat: 'crisis', url: 'https://veteranscrisisline.net/' },
      { id: 2, name: 'ADMH', cat: 'crisis', url: 'https://mh.alabama.gov/' },
      { id: 3, name: 'Give', cat: 'crisis', url: 'https://giveanhour.org/' },
      { id: 4, name: 'Centerstone', cat: 'crisis', url: 'https://centerstone.org/' },
    ],
    { fetchImpl, timeoutMs: 20, previousById: { 1: 'timed_out' } },
  );
  assert.equal(report.publicContentChanged, false);
  assert.deepEqual(report.results.find((item) => item.id === 1).flags, ['healthy', 'recovered']);
  assert.ok(report.results.find((item) => item.id === 2).flags.includes('suspicious_redirect'));
  assert.ok(report.results.find((item) => item.id === 3).flags.includes('broken'));
  assert.ok(report.results.find((item) => item.id === 4).flags.includes('timed_out'));
});
