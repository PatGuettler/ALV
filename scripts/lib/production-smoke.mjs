const REQUIRED_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'content-security-policy',
];

export const PRODUCTION_SMOKE_ROUTES = ['/', '/about/', '/resources/', '/warrior-retreat/'];

function headerMap(headers) {
  const result = {};
  if (!headers) return result;
  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      result[String(key).toLowerCase()] = value;
    });
    return result;
  }
  for (const [key, value] of Object.entries(headers)) {
    result[String(key).toLowerCase()] = value;
  }
  return result;
}

export function evaluateProductionSmoke(observations) {
  const failures = [];
  if (observations.httpsHome?.status !== 200) {
    failures.push(`HTTPS home returned ${observations.httpsHome?.status || 'no response'}.`);
  }
  const location = observations.httpHome?.location || '';
  if (observations.httpHome?.status !== 301 && observations.httpHome?.status !== 302) {
    failures.push(
      `HTTP home did not redirect (${observations.httpHome?.status || 'no response'}).`,
    );
  } else if (!location.startsWith('https://')) {
    failures.push(`HTTP home redirected to ${location || 'a non-HTTPS location'}.`);
  }
  const headers = observations.httpsHome?.headers || {};
  for (const name of REQUIRED_HEADERS) {
    if (!headers[name]) failures.push(`Missing security header ${name}.`);
  }
  for (const route of observations.routes || []) {
    if (route.status !== 200) failures.push(`${route.path} returned ${route.status}.`);
    if (!route.body?.includes('Alabama Veteran')) {
      failures.push(`${route.path} is missing site navigation copy.`);
    }
    if (!route.body?.includes('tel:988'))
      failures.push(`${route.path} is missing the 988 crisis link.`);
  }
  return failures;
}

export async function collectProductionSmoke(origin, { fetchImpl = fetch } = {}) {
  const httpsOrigin = new URL(origin).origin;
  const httpOrigin = httpsOrigin.replace(/^https:/, 'http:');
  const httpsHome = await fetchImpl(`${httpsOrigin}/`, { redirect: 'manual' });
  const httpHome = await fetchImpl(`${httpOrigin}/`, { redirect: 'manual' });
  const routes = [];
  for (const path of PRODUCTION_SMOKE_ROUTES) {
    const response = await fetchImpl(`${httpsOrigin}${path}`, { redirect: 'follow' });
    routes.push({
      path,
      status: response.status,
      body: await response.text(),
    });
  }
  return {
    httpsHome: {
      status: httpsHome.status,
      headers: headerMap(httpsHome.headers),
    },
    httpHome: {
      status: httpHome.status,
      location: httpHome.headers?.get?.('location') || headerMap(httpHome.headers).location || '',
    },
    routes,
  };
}
