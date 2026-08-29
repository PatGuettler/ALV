import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

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

const server = await preview({
  configFile: resolve(projectRoot, 'vite.config.js'),
  preview: { host: '127.0.0.1', port: 4173, strictPort: false },
});

const siteUrl = server.resolvedUrls?.local?.[0];
if (!siteUrl) {
  await server.close();
  throw new Error('Vite did not provide a local preview URL.');
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const browserErrors = [];

page.on('pageerror', (error) => browserErrors.push(error.message));

try {
  await page.goto(siteUrl, { waitUntil: 'networkidle' });

  const expectedSections = [
    'home',
    'news',
    'warrior',
    'circle',
    'active',
    'topgolf',
    'events',
    'resources',
    'about',
  ];

  for (const section of expectedSections) {
    await page.evaluate((name) => window.showPage(name), section);
    await page.locator(`#page-${section}.active`).waitFor({ state: 'visible' });
  }

  await page.evaluate(() => window.showPage('resources'));
  await page.locator('#search-input').fill('housing');
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('#all-grid .res-card')];
    return cards.length > 0 && cards.some((card) => card.offsetParent !== null);
  });

  const crisisHref = await page.locator('a[href="tel:988"]').first().getAttribute('href');
  if (crisisHref !== 'tel:988') {
    throw new Error('The 988 crisis link is missing.');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.showPage('home'));
  await page.locator('.nav-burger').click();
  await page.locator('nav.menu-open .nav-links').waitFor({ state: 'visible' });

  await page.goto(new URL('warrior-retreat-application.html', siteUrl).href, {
    waitUntil: 'networkidle',
  });
  await page.locator('input[name="applicant_type"]').first().waitFor({ state: 'attached' });

  if (browserErrors.length > 0) {
    throw new Error(`Browser errors:\n${browserErrors.join('\n')}`);
  }

  console.log(`Browser smoke test passed for ${expectedSections.length} site sections and the retreat application.`);
} finally {
  await browser.close();
  await server.close();
}
