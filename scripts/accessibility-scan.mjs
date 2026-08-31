import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';

const projectRoot = resolve(import.meta.dirname, '..');
const astroCli = resolve(projectRoot, 'node_modules/astro/bin/astro.mjs');
const reportDirectory = resolve(projectRoot, 'artifacts', 'accessibility');
const reportPath = resolve(reportDirectory, 'axe-report.json');
const port = 4174;
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const routes = [
  '',
  'news/',
  'warrior-retreat/',
  'warrior-retreat-application/',
  'av-circle/',
  'about/',
  'av-active/',
  'topgolf/',
  'events/',
  'resources/',
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'mobile', width: 412, height: 915 },
];
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const blockingImpacts = new Set(['serious', 'critical']);

let executablePath;
for (const candidate of chromeCandidates) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {
    // Try the next well-known browser path.
  }
}

if (!executablePath) {
  throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run accessibility scans.');
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

const browser = await chromium.launch({ executablePath, headless: true });
const scans = [];
let axeVersion;

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

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const route of routes) {
      const url = new URL(route, siteUrl).href;
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${viewport.name} route failed to load: ${url}`);

      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      axeVersion ??= results.testEngine.version;
      scans.push({
        viewport: viewport.name,
        dimensions: { width: viewport.width, height: viewport.height },
        route: route || '/',
        url,
        violations: results.violations,
      });
    }

    await context.close();
  }

  const blockingViolations = scans.flatMap((scan) =>
    scan.violations
      .filter(({ impact }) => blockingImpacts.has(impact))
      .map((violation) => ({
        viewport: scan.viewport,
        route: scan.route,
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
      })),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    tool: '@axe-core/playwright',
    axeVersion,
    configuration: {
      tags: axeTags,
      blockingImpacts: [...blockingImpacts],
      routes: routes.map((route) => route || '/'),
      viewports,
    },
    summary: {
      scans: scans.length,
      violations: scans.reduce((total, scan) => total + scan.violations.length, 0),
      blockingViolations: blockingViolations.length,
    },
    blockingViolations,
    scans,
  };

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (blockingViolations.length > 0) {
    const details = blockingViolations
      .map(
        ({ viewport, route, id, impact, nodes }) =>
          `${impact}: ${id} on ${route} (${viewport}, ${nodes} node${nodes === 1 ? '' : 's'})`,
      )
      .join('\n');
    throw new Error(
      `${blockingViolations.length} serious or critical accessibility finding(s):\n${details}\n` +
        `Full report: ${reportPath}`,
    );
  }

  console.log(
    `Accessibility scan passed ${scans.length} route/viewport combinations with no serious or critical findings.`,
  );
  console.log(`Full report: ${reportPath}`);
} finally {
  await browser.close();
  await stopPreviewServer();
}
