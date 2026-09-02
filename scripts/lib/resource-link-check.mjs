const MULTI_PART_SUFFIXES = new Set(['co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.au']);

export function registrableDomain(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return host;
  const tailTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(tailTwo) && parts.length >= 3) return parts.slice(-3).join('.');
  return tailTwo;
}

export function classifyLinkCheck({ url, hops = [], error = '', previousStatus = '' } = {}) {
  const flags = [];
  let original;
  try {
    original = new URL(url);
  } catch {
    return { url, flags: ['broken'], finalUrl: '', status: 0 };
  }

  if (error === 'timeout') {
    return { url, flags: ['timed_out'], finalUrl: '', status: 0 };
  }
  if (error || !hops.length) {
    return { url, flags: ['broken'], finalUrl: '', status: 0 };
  }

  const finalHop = hops[hops.length - 1];
  const finalUrl = String(finalHop.url || url);
  let finalHost = '';
  try {
    finalHost = new URL(finalUrl).hostname;
  } catch {
    return { url, flags: ['broken'], finalUrl, status: Number(finalHop.status) || 0 };
  }

  const redirected = hops.some((hop) => hop.status >= 300 && hop.status < 400);
  const ownerChanged = registrableDomain(original.hostname) !== registrableDomain(finalHost);
  const status = Number(finalHop.status) || 0;

  if (status >= 400) flags.push('broken');
  else if (ownerChanged) {
    flags.push('suspicious_redirect');
    flags.push('content_owner_change');
  } else if (redirected) flags.push('redirected');
  else flags.push('healthy');

  if (
    ['broken', 'timed_out'].includes(previousStatus) &&
    (flags.includes('healthy') || flags.includes('redirected'))
  ) {
    flags.push('recovered');
  }

  return { url, flags, finalUrl, status };
}

export function buildLinkCheckReport(results) {
  return {
    generatedAt: new Date().toISOString(),
    publicContentChanged: false,
    totals: {
      checked: results.length,
      healthy: results.filter((result) => result.flags.includes('healthy')).length,
      redirected: results.filter((result) => result.flags.includes('redirected')).length,
      broken: results.filter((result) => result.flags.includes('broken')).length,
      timedOut: results.filter((result) => result.flags.includes('timed_out')).length,
      recovered: results.filter((result) => result.flags.includes('recovered')).length,
      suspicious: results.filter((result) => result.flags.includes('suspicious_redirect')).length,
    },
    results,
  };
}
