import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { publicResourceLinks } from '../src/scripts/resources.js';
import { buildLinkCheckReport, classifyLinkCheck } from './lib/resource-link-check.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const reportPath = resolve(projectRoot, 'artifacts', 'link-checks', 'report.json');

export async function probeUrl(
  url,
  { fetchImpl = fetch, timeoutMs = 8_000, redirect = 'manual' } = {},
) {
  const hops = [];
  let current = url;
  for (let index = 0; index < 5; index += 1) {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, {
        method: 'HEAD',
        redirect,
        signal: abortController.signal,
        headers: { 'User-Agent': 'alabama-veteran-link-check' },
      });
    } catch (error) {
      clearTimeout(timer);
      if (error?.name === 'AbortError') return { error: 'timeout', hops };
      return { error: 'network', hops };
    }
    clearTimeout(timer);
    hops.push({ url: current, status: response.status });
    if (response.status < 300 || response.status >= 400) return { hops };
    const location = response.headers.get('location');
    if (!location) return { hops };
    current = new URL(location, current).href;
  }
  return { hops };
}

export async function checkResourceLinks(links, options = {}) {
  const results = [];
  for (const link of links) {
    const probe = await probeUrl(link.url, options);
    results.push({
      id: link.id,
      name: link.name,
      cat: link.cat,
      ...classifyLinkCheck({
        url: link.url,
        hops: probe.hops,
        error: probe.error,
        previousStatus: options.previousById?.[link.id],
      }),
    });
  }
  return buildLinkCheckReport(results);
}

if (import.meta.main || process.argv[1]?.endsWith('resource-link-check.mjs')) {
  if (process.env.RESOURCE_LINK_CHECK_LIVE !== '1') {
    console.log(
      'Resource link checks write a report only. Set RESOURCE_LINK_CHECK_LIVE=1 to probe live URLs. Public directory content is never rewritten.',
    );
    process.exit(0);
  }
  const report = await checkResourceLinks(publicResourceLinks());
  await mkdir(resolve(projectRoot, 'artifacts', 'link-checks'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${report.totals.checked} link checks to ${reportPath}`);
}
