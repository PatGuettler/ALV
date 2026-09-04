export const retreatPublic = {
  apiUrl: 'https://p364msgsc2.execute-api.us-east-1.amazonaws.com',
  cognitoDomain: 'https://alv-prod-retreat-286801153738.auth.us-east-1.amazoncognito.com',
  clientId: '37tsmb3p4du202e1vmstblsrui',
};

function siteEnvironment() {
  try {
    const fromVite = import.meta.env?.SITE_ENV;
    if (fromVite) return String(fromVite);
  } catch {
    // Node tests and scripts do not inject Vite env.
  }
  return typeof process !== 'undefined' && process.env.SITE_ENV ? process.env.SITE_ENV : '';
}

const collectionEnvironments = new Set(['production', 'staging', '']);

export const retreatLive = Boolean(
  collectionEnvironments.has(siteEnvironment()) &&
  retreatPublic.apiUrl &&
  retreatPublic.cognitoDomain &&
  retreatPublic.clientId,
);
