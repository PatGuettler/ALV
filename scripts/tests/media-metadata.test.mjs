import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMediaRecord } from '../../src/config/media.js';

const published = {
  schemaVersion: 1,
  id: 'photo-retreat-2026-01',
  kind: 'photo',
  title: 'Warrior Retreat cadre at sunrise',
  caption: 'Cadre prepare the morning session.',
  altText: 'Four veterans standing beside a lake at sunrise',
  status: 'published',
  publishDate: '2026-06-01',
  reviewDate: '2026-05-20',
  derivativeUrl: 'https://media.alabamaveteran.org/photo-retreat-2026-01.webp',
  originalKey: 'originals/2026/photo-retreat-2026-01.jpg',
  consent: { subjectConsent: true, recordedAt: '2026-05-18', recordedBy: 'alv-staff' },
  rights: { owner: 'Alabama Veteran', license: 'all-rights-reserved' },
};

test('normalizes published photo, video, album, and quarterly impact story records', () => {
  assert.equal(normalizeMediaRecord(published)?.kind, 'photo');
  assert.equal(
    normalizeMediaRecord({
      ...published,
      id: 'video-1',
      kind: 'video',
      transcript: 'Welcome to this quarter’s retreat recap.',
    })?.kind,
    'video',
  );
  assert.equal(
    normalizeMediaRecord({
      ...published,
      id: 'album-1',
      kind: 'album',
      albumItems: ['photo-retreat-2026-01'],
    })?.albumItems[0],
    'photo-retreat-2026-01',
  );
  assert.equal(
    normalizeMediaRecord({
      ...published,
      id: 'story-2026-q2',
      kind: 'quarterly-impact-story',
      title: 'Q2 impact',
      body: 'Veterans described reconnecting with peers after the retreat.',
      altText: '',
    })?.kind,
    'quarterly-impact-story',
  );
});

test('rejects published media that is missing consent, rights, alt text, or a transcript', () => {
  assert.equal(normalizeMediaRecord({ ...published, altText: '' }), null);
  assert.equal(
    normalizeMediaRecord({ ...published, kind: 'video', id: 'video-1', transcript: '' }),
    null,
  );
  assert.equal(
    normalizeMediaRecord({
      ...published,
      consent: { subjectConsent: false, recordedAt: '2026-05-18' },
    }),
    null,
  );
  assert.equal(
    normalizeMediaRecord({ ...published, rights: { owner: '', license: 'cc-by' } }),
    null,
  );
  assert.equal(
    normalizeMediaRecord({ ...published, derivativeUrl: 'http://insecure.example/x' }),
    null,
  );
});

test('rejects withdrawn records that drop required consent after publication', () => {
  assert.equal(normalizeMediaRecord({ ...published, status: 'withdrawn', consent: {} }), null);
  assert.equal(normalizeMediaRecord({ ...published, status: 'review' })?.status, 'review');
});

test('allows draft records without a public derivative URL', () => {
  const draft = normalizeMediaRecord({
    ...published,
    status: 'draft',
    publishDate: '',
    reviewDate: '',
    derivativeUrl: '',
    consent: { subjectConsent: false, recordedAt: '', recordedBy: '' },
  });
  assert.equal(draft?.status, 'draft');
  assert.equal(draft?.derivativeUrl, '');
});
