import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const projectRoot = resolve(import.meta.dirname, '..');
const astroCli = resolve(projectRoot, 'node_modules/astro/bin/astro.mjs');
const reportDirectory = resolve(projectRoot, 'artifacts', 'performance');
const reportPath = resolve(reportDirectory, 'lighthouse-budget-report.json');
const budget = JSON.parse(await readFile(resolve(projectRoot, 'performance-budget.json'), 'utf8'));
const port = 4175;
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const profiles = [
  { name: 'home-mobile', route: '', preset: undefined },
  { name: 'resources-desktop', route: 'resources/', preset: 'desktop' },
];

let chromePath;
for (const candidate of chromeCandidates) {
  try {
    await access(candidate);
    chromePath = candidate;
    break;
  } catch {
    // Try the next well-known browser path.
  }
}

if (!chromePath) {
  throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run Lighthouse.');
}

const server = spawn(
  process.execPath,
  [astroCli, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: projectRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverOutput = '';
server.stdout.on('data', (chunk) => (serverOutput += chunk));
server.stderr.on('data', (chunk) => (serverOutput += chunk));

const trimmedBase = (process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '');
const siteUrl = `http://127.0.0.1:${port}/${trimmedBase ? `${trimmedBase}/` : ''}`;

for (let attempt = 0; attempt < 50; attempt++) {
  try {
    const response = await fetch(siteUrl);
    if (response.ok) break;
  } catch {
    // Preview is still starting.
  }
  if (attempt === 49) throw new Error(`Astro preview failed to start.\n${serverOutput}`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
}

async function stopPreviewServer() {
  server.kill('SIGTERM');
  await new Promise((resolveStop) => {
    const stop = spawn(process.execPath, [astroCli, 'preview', 'stop'], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'ignore',
    });
    stop.on('error', resolveStop);
    stop.on('close', resolveStop);
  });
}

function largestRequest(requests, resourceType) {
  const candidates = requests.filter((request) => request.resourceType === resourceType);
  const largest = candidates.sort((left, right) => right.transferSize - left.transferSize)[0];
  return largest
    ? { url: largest.url, bytes: largest.transferSize, resourceType: largest.resourceType }
    : { url: null, bytes: 0, resourceType };
}

function metric(lhr, auditId) {
  return lhr.audits[auditId]?.numericValue;
}

const chrome = await launch({
  chromePath,
  chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
});
const results = [];

try {
  for (const profile of profiles) {
    const url = new URL(profile.route, siteUrl).href;
    const runner = await lighthouse(
      url,
      {
        port: chrome.port,
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance'],
        ...(profile.preset ? { preset: profile.preset } : {}),
      },
      undefined,
    );
    if (!runner?.lhr) throw new Error(`Lighthouse returned no result for ${profile.name}.`);

    const requests = runner.lhr.audits['network-requests'].details?.items ?? [];
    results.push({
      profile: profile.name,
      url,
      lighthouseVersion: runner.lhr.lighthouseVersion,
      fetchTime: runner.lhr.fetchTime,
      metrics: {
        lighthousePerformanceScore: runner.lhr.categories.performance.score,
        largestContentfulPaintMs: metric(runner.lhr, 'largest-contentful-paint'),
        cumulativeLayoutShift: metric(runner.lhr, 'cumulative-layout-shift'),
        totalBlockingTimeMs: metric(runner.lhr, 'total-blocking-time'),
        totalTransferBytes: metric(runner.lhr, 'total-byte-weight'),
      },
      largestAssets: {
        image: largestRequest(requests, 'Image'),
        font: largestRequest(requests, 'Font'),
        stylesheet: largestRequest(requests, 'Stylesheet'),
        script: largestRequest(requests, 'Script'),
      },
    });
  }
} finally {
  await chrome.kill();
  await stopPreviewServer();
}

const failures = [];
for (const result of results) {
  const { metrics, largestAssets, profile } = result;
  const minimums = ['lighthousePerformanceScore'];
  for (const key of minimums) {
    if (metrics[key] < budget[key]) {
      failures.push(`${profile} ${key} ${metrics[key]} is below ${budget[key]}.`);
    }
  }
  for (const key of ['cumulativeLayoutShift', 'totalBlockingTimeMs', 'totalTransferBytes']) {
    if (metrics[key] > budget[key]) {
      failures.push(`${profile} ${key} ${metrics[key]} exceeds ${budget[key]}.`);
    }
  }
  if (metrics.largestContentfulPaintMs > budget.largestContentfulPaintCiMs) {
    failures.push(
      `${profile} largestContentfulPaintMs ${metrics.largestContentfulPaintMs} exceeds ` +
        `${budget.largestContentfulPaintCiMs}.`,
    );
  }
  for (const [assetType, budgetKey] of [
    ['image', 'largestImageBytes'],
    ['font', 'largestFontBytes'],
    ['stylesheet', 'largestStylesheetBytes'],
    ['script', 'largestScriptBytes'],
  ]) {
    if (largestAssets[assetType].bytes > budget[budgetKey]) {
      failures.push(
        `${profile} ${budgetKey} ${largestAssets[assetType].bytes} exceeds ${budget[budgetKey]} ` +
          `(${largestAssets[assetType].url}).`,
      );
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  conditions: {
    server: 'local production static build',
    lighthouseMode: 'simulated throttling',
    profiles: profiles.map(({ name, route, preset }) => ({
      name,
      route: route || '/',
      preset: preset || 'mobile',
    })),
    note: 'Lighthouse cannot measure field INP. Total Blocking Time is enforced as the lab proxy; the INP target applies to production field data.',
  },
  budget,
  results,
  failures,
};
await mkdir(reportDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length > 0) {
  throw new Error(`Performance budget failed:\n${failures.join('\n')}\nFull report: ${reportPath}`);
}

console.log(`Lighthouse performance budget passed ${results.length} representative profiles.`);
console.log(`Full report: ${reportPath}`);
