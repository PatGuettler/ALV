import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const projectRoot = resolve(import.meta.dirname, '..');
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

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
  throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run browser tests.');
}

const routes = new Map([
  ['home', ''],
  ['news', 'news/'],
  ['warrior', 'warrior-retreat/'],
  ['circle', 'av-circle/'],
  ['about', 'about/'],
  ['active', 'av-active/'],
  ['topgolf', 'topgolf/'],
  ['events', 'events/'],
  ['resources', 'resources/'],
]);

const server = spawn(
  process.execPath,
  [
    resolve(projectRoot, 'node_modules/astro/bin/astro.mjs'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
  ],
  { cwd: projectRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverOutput = '';
server.stdout.on('data', (chunk) => (serverOutput += chunk));
server.stderr.on('data', (chunk) => (serverOutput += chunk));

const trimmedBase = (process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '');
const siteUrl = `http://127.0.0.1:4173/${trimmedBase ? `${trimmedBase}/` : ''}`;

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

async function loadRoute(page, pageId, route, browserErrors) {
  browserErrors.length = 0;
  await page.goto(new URL(route, siteUrl).href, { waitUntil: 'networkidle' });
  await page.locator(`#page-${pageId}.active`).waitFor({ state: 'visible' });

  if (browserErrors.length > 0) {
    throw new Error(`${pageId} browser errors:\n${browserErrors.join('\n')}`);
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    page: document.querySelector('.page')?.scrollWidth ?? 0,
  }));

  const widest = Math.max(layout.document, layout.body, layout.page);
  if (widest > layout.viewport + 1) {
    throw new Error(`${label} overflows horizontally: ${JSON.stringify(layout)}`);
  }
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const desktopErrors = [];
  desktop.on('pageerror', (error) => desktopErrors.push(error.message));

  for (const [pageId, route] of routes) {
    await loadRoute(desktop, pageId, route, desktopErrors);
    await assertNoHorizontalOverflow(desktop, `${pageId} desktop`);
  }

  await loadRoute(desktop, 'home', '', desktopErrors);
  await desktop.locator('#nb-about').click();
  await desktop.waitForURL(/\/about\/$/);
  await desktop.locator('#page-about.active').waitFor({ state: 'visible' });

  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));

  for (const [pageId, route] of routes) {
    await loadRoute(mobile, pageId, route, mobileErrors);
    await assertNoHorizontalOverflow(mobile, `${pageId} mobile`);
  }

  await loadRoute(mobile, 'home', '', mobileErrors);
  await mobile.locator('.nav-burger').click();
  await mobile.locator('body > nav.menu-open .nav-links').waitFor({ state: 'visible' });
  await mobile.locator('#nb-resources').click();
  await mobile.waitForURL(/\/resources\/$/);
  await mobile.locator('#search-input').fill('housing');
  await mobile.waitForFunction(() => {
    const cards = [...document.querySelectorAll('#all-grid .res-card')];
    return cards.length > 0 && cards.some((card) => card.offsetParent !== null);
  });

  const crisisHref = await mobile.locator('a[href="tel:988"]').first().getAttribute('href');
  if (crisisHref !== 'tel:988') throw new Error('The 988 crisis link is missing.');

  for (const width of [320, 768]) {
    await mobile.setViewportSize({ width, height: 915 });
    await loadRoute(mobile, 'home', '', mobileErrors);
    await assertNoHorizontalOverflow(mobile, `home ${width}px`);
  }

  await desktop.goto(new URL('warrior-retreat-application/', siteUrl).href, {
    waitUntil: 'networkidle',
  });
  await desktop
    .getByRole('heading', { name: 'Application service not connected' })
    .waitFor({ state: 'visible' });

  await mobileContext.close();
  await desktop.close();
  console.log(
    `Browser smoke test passed for ${routes.size} responsive routes and the retreat application.`,
  );
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
