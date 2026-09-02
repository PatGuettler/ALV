/** Public GoHighLevel widgets. Do not put private API tokens here. */
export const ghl = {
  locationHost: 'https://app.alabamaveteran.org',
  newsletterFormId: 'hDcR5EwOHXT3Uuogr4eR',
  crisisFormId: 't9pQuFrpT0Yz2lYTwLVj',
  volunteerFormId: 'oA6BYtFTZ47lbNChjt2h',
  topgolfBookingPath: '/widget/bookings/top-golf-av-active',
  /** AV Events Calendar (GHL). Public site shows a display-only month view, not the booking widget. */
  eventsCalendarId: 'zfYlU1tekAs9O3E2xGT8',
  /** Dedicated GHL fundraiser calendar IDs. Empty until ALV pastes the scoped calendar IDs. */
  fundraiserCalendarIds: [],
};

export function ghlFormUrl(formId, { notrack = true } = {}) {
  const url = new URL(`/widget/form/${formId}`, ghl.locationHost);
  if (notrack) url.searchParams.set('notrack', 'true');
  return url.href;
}

export function ghlFormEmbedUrl(formId) {
  return `https://api.leadconnectorhq.com/widget/form/${formId}`;
}

export const ghlWidgets = {
  newsletter: ghlFormUrl(ghl.newsletterFormId),
  newsletterEmbed: ghlFormEmbedUrl(ghl.newsletterFormId),
  crisis: ghlFormUrl(ghl.crisisFormId),
  volunteer: ghlFormUrl(ghl.volunteerFormId),
  topgolfBooking: `${ghl.locationHost}${ghl.topgolfBookingPath}`,
};
