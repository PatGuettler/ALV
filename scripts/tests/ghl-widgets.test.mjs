import assert from 'node:assert/strict';
import test from 'node:test';

import { ghl, ghlFormEmbedUrl, ghlFormUrl, ghlWidgets } from '../../src/config/ghl.js';

test('ghlFormUrl builds the white-label widget with notrack', () => {
  const url = new URL(ghlFormUrl(ghl.newsletterFormId));
  assert.equal(url.origin, 'https://app.alabamaveteran.org');
  assert.equal(url.pathname, `/widget/form/${ghl.newsletterFormId}`);
  assert.equal(url.searchParams.get('notrack'), 'true');
});

test('ghlWidgets point newsletter, crisis, volunteer, and Topgolf at GHL', () => {
  assert.equal(ghlWidgets.newsletterEmbed, ghlFormEmbedUrl(ghl.newsletterFormId));
  assert.match(ghlWidgets.crisis, /t9pQuFrpT0Yz2lYTwLVj/);
  assert.match(ghlWidgets.volunteer, /oA6BYtFTZ47lbNChjt2h/);
  assert.match(ghlWidgets.topgolfBooking, /widget\/bookings\/top-golf-av-active/);
  assert.equal(ghl.locationId, 'jpHzkfKyYJW7cGNPHePS');
  assert.equal(ghl.eventsCalendarId, 'zfYlU1tekAs9O3E2xGT8');
  assert.equal(ghl.eventsCalendarEmbed, undefined);
  assert.equal(ghlWidgets.eventsBooking, undefined);
  assert.deepEqual(ghl.fundraiserCalendarIds, []);
});
