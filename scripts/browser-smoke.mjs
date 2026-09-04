import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { retreatLive } from '../src/config/retreat.js';

const projectRoot = resolve(import.meta.dirname, '..');
const astroCli = resolve(projectRoot, 'node_modules/astro/bin/astro.mjs');
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
  [astroCli, 'preview', '--host', '127.0.0.1', '--port', '4173'],
  { cwd: projectRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverOutput = '';
server.stdout.on('data', (chunk) => (serverOutput += chunk));
server.stderr.on('data', (chunk) => (serverOutput += chunk));

const trimmedBase = (process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '');
const siteUrl = `http://127.0.0.1:4173/${trimmedBase ? `${trimmedBase}/` : ''}`;
/** GoHighLevel embeds keep connections open, so networkidle never settles. */
const pageReady = 'domcontentloaded';

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

async function loadRoute(page, pageId, route, browserErrors) {
  browserErrors.length = 0;
  await page.goto(new URL(route, siteUrl).href, { waitUntil: pageReady });
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

function assertLayout(condition, message, details) {
  if (!condition) {
    throw new Error(`${message}: ${JSON.stringify(details)}`);
  }
}

async function assertCircleCompanies(page, label) {
  await page.locator('.circle-preview').scrollIntoViewIfNeeded();
  const logos = page.locator('.cp-companies .circ-co-row img');
  if ((await logos.count()) < 4) {
    throw new Error(`${label} AV Circle companies are missing from the homepage.`);
  }
  const first = logos.first();
  await first.waitFor({ state: 'visible' });
  const size = await first.evaluate((img) => {
    const style = getComputedStyle(img);
    return {
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      width: img.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height,
      filter: style.filter,
      opacity: Number(style.opacity),
    };
  });
  if (!size.naturalWidth || size.width < 24 || size.height < 20 || size.opacity < 0.2) {
    throw new Error(`${label} AV Circle companies are not visible: ${JSON.stringify(size)}`);
  }
  if (/invert\(/.test(size.filter)) {
    throw new Error(`${label} AV Circle logos are inverted onto the white company card.`);
  }
}

async function assertSponsorMarquee(page, label) {
  await page.locator('.spon-section').scrollIntoViewIfNeeded();
  const logo = page.locator('.spon-track .spon-item:not([aria-hidden]) img').first();
  await logo.waitFor({ state: 'visible' });
  const size = await logo.evaluate((img) => ({
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    width: img.getBoundingClientRect().width,
    height: img.getBoundingClientRect().height,
  }));
  if (!size.naturalWidth || size.width < 24 || size.height < 20) {
    throw new Error(`${label} sponsor logos are not visible: ${JSON.stringify(size)}`);
  }
}

async function assertEventsHero(page, label) {
  const layout = await page.evaluate(() => {
    const hero = document.querySelector('.evp-hero');
    const subtitle = document.querySelector('.evp-hero-sub');
    const heroRect = hero.getBoundingClientRect();
    const subtitleRect = subtitle.getBoundingClientRect();

    const parseColor = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return {
        red: channels[0] ?? 0,
        green: channels[1] ?? 0,
        blue: channels[2] ?? 0,
        alpha: channels[3] ?? 1,
      };
    };
    const foreground = parseColor(getComputedStyle(subtitle).color);
    const background = parseColor(getComputedStyle(hero).backgroundColor);
    const composite = ['red', 'green', 'blue'].map(
      (channel) =>
        foreground[channel] * foreground.alpha + background[channel] * (1 - foreground.alpha),
    );
    const luminance = (channels) => {
      const [red, green, blue] = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const foregroundLuminance = luminance(composite);
    const backgroundLuminance = luminance([background.red, background.green, background.blue]);

    return {
      contrast:
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      hero: {
        left: heroRect.left,
        right: heroRect.right,
        top: heroRect.top,
        bottom: heroRect.bottom,
      },
      subtitle: {
        left: subtitleRect.left,
        right: subtitleRect.right,
        top: subtitleRect.top,
        bottom: subtitleRect.bottom,
        width: subtitleRect.width,
        height: subtitleRect.height,
      },
    };
  });

  const insideHero =
    layout.subtitle.width > 0 &&
    layout.subtitle.height > 0 &&
    layout.subtitle.left >= layout.hero.left - 1 &&
    layout.subtitle.right <= layout.hero.right + 1 &&
    layout.subtitle.top >= layout.hero.top - 1 &&
    layout.subtitle.bottom <= layout.hero.bottom + 1;
  assertLayout(insideHero, `${label} events subtitle is clipped`, layout);
  assertLayout(layout.contrast >= 4.5, `${label} events subtitle contrast is too low`, layout);
}

async function assertAvrcStrip(page, label) {
  const layout = await page.evaluate(() => {
    const strip = document.querySelector('.avrc-strip').getBoundingClientRect();
    const details = document.querySelector('.avrc-details').getBoundingClientRect();
    const action = document.querySelector('.avrc-inner a').getBoundingClientRect();
    const items = [...document.querySelectorAll('.avrc-details span')].map((item) => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const overlap =
      details.left < action.right &&
      details.right > action.left &&
      details.top < action.bottom &&
      details.bottom > action.top;

    return {
      strip: { left: strip.left, right: strip.right, top: strip.top, bottom: strip.bottom },
      details: {
        left: details.left,
        right: details.right,
        top: details.top,
        bottom: details.bottom,
      },
      action: {
        left: action.left,
        right: action.right,
        top: action.top,
        bottom: action.bottom,
        width: action.width,
        height: action.height,
      },
      items,
      overlap,
    };
  });

  const elements = [layout.details, layout.action, ...layout.items];
  const allInside = elements.every(
    (rect) =>
      rect.right > rect.left &&
      rect.bottom > rect.top &&
      rect.left >= layout.strip.left - 1 &&
      rect.right <= layout.strip.right + 1 &&
      rect.top >= layout.strip.top - 1 &&
      rect.bottom <= layout.strip.bottom + 1,
  );
  assertLayout(allInside, `${label} AVRC content is clipped`, layout);
  assertLayout(!layout.overlap, `${label} AVRC details overlap the call to action`, layout);
}

async function assertMissionStrip(page, label) {
  const layout = await page.evaluate(() => {
    const strip = document.querySelector('.mstrip').getBoundingClientRect();
    const items = [...document.querySelectorAll('.mstrip-list li')].map((item) => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const overlaps = items.some((item, index) =>
      items
        .slice(index + 1)
        .some(
          (other) =>
            item.left < other.right &&
            item.right > other.left &&
            item.top < other.bottom &&
            item.bottom > other.top,
        ),
    );
    return {
      strip: { left: strip.left, right: strip.right, top: strip.top, bottom: strip.bottom },
      items,
      overlaps,
    };
  });

  const allInside =
    layout.items.length === 4 &&
    layout.items.every(
      (rect) =>
        rect.right > rect.left &&
        rect.bottom > rect.top &&
        rect.left >= layout.strip.left - 1 &&
        rect.right <= layout.strip.right + 1 &&
        rect.top >= layout.strip.top - 1 &&
        rect.bottom <= layout.strip.bottom + 1,
    );
  assertLayout(allInside, `${label} mission-strip content is clipped`, layout);
  assertLayout(!layout.overlaps, `${label} mission-strip items overlap`, layout);
}

async function assertCrisisControl(page, label, width) {
  const layout = await page.evaluate(() => {
    const footer = document.querySelector('body > footer').getBoundingClientRect();
    const action = document.querySelector('.nl-float').getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      position: getComputedStyle(document.querySelector('.nl-float')).position,
      footer: { top: footer.top, bottom: footer.bottom },
      action: {
        left: action.left,
        right: action.right,
        top: action.top,
        bottom: action.bottom,
        width: action.width,
        height: action.height,
      },
    };
  });

  if (width <= 900) {
    const followsFooter =
      layout.position === 'static' &&
      layout.action.top >= layout.footer.bottom - 1 &&
      Math.abs(layout.action.width - layout.viewportWidth) <= 1;
    assertLayout(followsFooter, `${label} crisis control covers mobile content`, layout);
    return;
  }

  const insideViewport =
    layout.position === 'fixed' &&
    layout.action.left >= 0 &&
    layout.action.right <= layout.viewportWidth &&
    layout.action.top >= 0 &&
    layout.action.bottom <= layout.viewportHeight;
  assertLayout(insideViewport, `${label} crisis control is outside the desktop viewport`, layout);
}

async function assertRetreatStatus(page, label) {
  await page.goto(new URL('warrior-retreat-application/', siteUrl).href, {
    waitUntil: pageReady,
  });
  const heading = retreatLive ? 'Warrior Retreat Application' : 'Application service not connected';
  await page.getByRole('heading', { name: heading }).waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(page, `${label} retreat status`);

  if (retreatLive) {
    await page.locator('input[name="applicantType"][value="military"]').check();
    await page.locator('input[name="retreatType"][value="mens"]').check();
    await page.locator('select[name="timingPreference"]').selectOption('next-available');
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByRole('group', { name: 'Your contact information' })
      .waitFor({ state: 'visible' });
    await page.locator('input[name="phone"]').fill('2055550100');
    await page.locator('input[name="phone"]').blur();
    const phoneValue = await page.locator('input[name="phone"]').inputValue();
    if (phoneValue !== '(205) 555-0100') {
      throw new Error(`Phone did not keep a 10-digit format: ${phoneValue}`);
    }
    await page.locator('input[name="email"]').fill('pat@office');
    await page.locator('input[name="email"]').blur();
    await page.locator('#email-error').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#firstName-error').waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(page, `${label} retreat contact step`);
    await page.getByRole('button', { name: 'Back' }).click();
  }

  const layout = await page.evaluate((live) => {
    const card = document
      .querySelector(live ? '.retreat-application-shell' : '.retreat-status')
      .getBoundingClientRect();
    const link = document
      .querySelector(live ? '.application-back' : '.return-link a')
      .getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      card: {
        left: card.left,
        right: card.right,
        top: card.top,
        bottom: card.bottom,
        width: card.width,
        height: card.height,
      },
      link: {
        left: link.left,
        right: link.right,
        top: link.top,
        bottom: link.bottom,
        width: link.width,
        height: link.height,
      },
    };
  }, retreatLive);
  const usable =
    layout.card.width > 0 &&
    layout.card.left >= 0 &&
    layout.card.right <= layout.viewportWidth &&
    layout.link.width > 0 &&
    layout.link.height >= 44 &&
    layout.link.left >= layout.card.left &&
    layout.link.right <= layout.card.right &&
    layout.link.top >= layout.card.top &&
    layout.link.bottom <= layout.card.bottom;
  assertLayout(usable, `${label} retreat status panel or return link is clipped`, layout);

  if (retreatLive) {
    await page.goto(new URL('warrior-retreat-staff/', siteUrl).href, { waitUntil: pageReady });
    await page
      .getByRole('heading', { name: 'Retreat Administration' })
      .waitFor({ state: 'visible' });
    await page
      .getByRole('button', { name: 'Continue to secure sign in' })
      .waitFor({ state: 'visible' });
    if ((await page.locator('#retreat-staff-dialog-reference').count()) !== 1) {
      throw new Error('Staff application dialog is missing the reference number.');
    }
    if ((await page.getByPlaceholder('Name, email, phone, or reference number').count()) !== 1) {
      throw new Error('Staff search does not look up the application reference number.');
    }
    await assertNoHorizontalOverflow(page, `${label} retreat staff login`);
  }
}

async function completeRequiredRetreatSteps(page) {
  await page.goto(new URL('warrior-retreat-application/', siteUrl).href, {
    waitUntil: pageReady,
  });
  await page.locator('input[name="applicantType"][value="military"]').check();
  await page.locator('input[name="retreatType"][value="mens"]').check();
  await page.locator('select[name="timingPreference"]').selectOption('next-available');
  await page.locator('#retreat-next').focus();
  await page.keyboard.press('Enter');
  await page.locator('#contact-step-title').waitFor({ state: 'visible' });
  const focusedContactHeading = await page.evaluate(
    () => document.activeElement?.id === 'contact-step-title',
  );
  assertLayout(focusedContactHeading, 'Retreat step heading did not receive keyboard focus', {});

  await page.locator('#retreat-next').click();
  const focusedInvalidField = await page.evaluate(
    () => document.activeElement?.getAttribute('name') === 'firstName',
  );
  assertLayout(focusedInvalidField, 'Retreat validation did not focus the first invalid field', {});

  await page.locator('input[name="firstName"]').fill('Test');
  await page.locator('input[name="lastName"]').fill('Applicant');
  await page.locator('input[name="dateOfBirth"]').fill('1980-01-01');
  await page.locator('input[name="phone"]').fill('2055550100');
  await page.locator('input[name="email"]').fill('test.applicant@example.com');
  await page.locator('input[name="city"]').fill('Birmingham');
  await page.locator('select[name="state"]').selectOption('AL');
  await page.locator('input[name="postalCode"]').fill('35203');
  await page.locator('#retreat-next').click();

  await page.locator('input[name="militaryStatus"][value="veteran"]').check();
  await page.locator('select[name="militaryBranch"]').selectOption('army');
  await page.locator('#retreat-next').click();
  await page.locator('select[name="employmentStatus"]').selectOption('retired');
  await page.locator('#retreat-next').click();
  await page.locator('#retreat-next').click();

  await page.locator('input[name="emergencyName"]').fill('Test Contact');
  await page.locator('input[name="emergencyRelationship"]').fill('Friend');
  await page.locator('input[name="emergencyPhone"]').fill('2055550199');
  await page.locator('textarea[name="goals"]').fill('Test the application workflow.');
  for (const name of [
    'accuracyAgreement',
    'contactConsent',
    'placementAgreement',
    'policyAgreement',
  ]) {
    await page.locator(`input[name="${name}"]`).check();
  }
  await page.locator('input[name="signature"]').fill('Test Applicant');
  await page.locator('input[name="signatureDate"]').fill(new Date().toISOString().slice(0, 10));
  await page.locator('#retreat-next').click();
  await page.locator('#review-title').waitFor({ state: 'visible' });
}

async function assertRetreatSubmissionFailuresAndRetry(page) {
  const applicationRoute = '**/v1/applications';
  let attempts = 0;
  await page.route(applicationRoute, async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'test-browser-receipt' }),
    });
  });
  await completeRequiredRetreatSteps(page);
  await page.locator('#retreat-submit').click();
  await page
    .getByText('The application could not be sent. Your entries are still here; please try again.')
    .waitFor({ state: 'visible' });
  const retainedGoal = await page.locator('textarea[name="goals"]').inputValue();
  assertLayout(
    retainedGoal === 'Test the application workflow.',
    'Retreat API failure discarded entered data',
    { retainedGoal },
  );
  await page.locator('#retreat-submit').click();
  await page.locator('#retreat-application-receipt').waitFor({ state: 'visible' });
  const reference = await page.locator('#retreat-application-reference').textContent();
  const receiptFocused = await page.evaluate(
    () => document.activeElement?.id === 'retreat-application-receipt',
  );
  assertLayout(
    attempts === 2 && reference === 'TEST-BROWSER-RECEIPT' && receiptFocused,
    'Retreat retry did not produce a focused durable receipt',
    { attempts, reference, receiptFocused },
  );
  await page.unroute(applicationRoute);
}

async function assertRetreatSubmissionTimeout(page) {
  const applicationRoute = '**/v1/applications';
  await page.route(applicationRoute, async (route) => {
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    await route
      .fulfill({ status: 504, contentType: 'application/json', body: '{}' })
      .catch(() => {});
  });
  await completeRequiredRetreatSteps(page);
  await page.locator('#retreat-submit').click();
  await page
    .getByText('The request timed out. Your entries are still here; please try again.')
    .waitFor({ state: 'visible' });
  const stillEditable = await page.locator('textarea[name="goals"]').isEditable();
  assertLayout(stillEditable, 'Retreat timeout did not restore the editable form', {});
  await page.unroute(applicationRoute);
}

async function assertDisplayEventsCalendar(page, label) {
  await page.locator('[data-events-calendar]').waitFor({ state: 'visible' });
  await page.locator('[data-cal-grid] .evp-day').first().waitFor({ state: 'visible' });
  const bookingEmbeds = await page.locator('iframe[src*="widget/booking"]').count();
  const selectButtons = await page.getByRole('button', { name: /^select$/i }).count();
  const days = await page.locator('[data-cal-grid] .evp-day').count();
  if (bookingEmbeds > 0 || selectButtons > 0 || days < 28) {
    throw new Error(
      `${label} events page is still a scheduler: ${JSON.stringify({ bookingEmbeds, selectButtons, days })}`,
    );
  }
}

async function assertCustomerReportedLayouts(page, label, width, browserErrors) {
  await loadRoute(page, 'events', 'events/', browserErrors);
  await assertNoHorizontalOverflow(page, `${label} events`);
  await assertEventsHero(page, label);
  await assertDisplayEventsCalendar(page, label);

  await loadRoute(page, 'resources', 'resources/', browserErrors);
  await assertNoHorizontalOverflow(page, `${label} resources`);
  await assertAvrcStrip(page, label);

  await loadRoute(page, 'home', '', browserErrors);
  await assertNoHorizontalOverflow(page, `${label} home`);
  await assertMissionStrip(page, label);
  await assertCircleCompanies(page, label);
  await assertSponsorMarquee(page, label);
  await assertCrisisControl(page, label, width);

  await assertRetreatStatus(page, label);
}

async function assertFeaturedFundraiser(page, browserErrors) {
  await page.route('**/data/featured-fundraiser.json', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await loadRoute(page, 'home', '', browserErrors);
  const hiddenBanner = page.locator('[data-featured-fundraiser]');
  await hiddenBanner.waitFor({ state: 'attached' });
  if (await hiddenBanner.isVisible()) {
    throw new Error('Featured fundraiser banner rendered without a qualifying public event.');
  }
  await page.unroute('**/data/featured-fundraiser.json');

  await page.route('**/data/featured-fundraiser.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        events: [
          {
            id: 'browser-fundraiser',
            title:
              'War on the Greens — A deliberately long fundraiser title that must wrap without overflowing',
            startAt: new Date(Date.now() + 86_400_000).toISOString(),
            endAt: new Date(Date.now() + 90_000_000).toISOString(),
            venue: 'Inverness Country Club, Birmingham, AL',
            summary: 'Browser-only event fixture',
            url: 'https://alabamaveteran.org/events/war-on-the-greens',
            category: 'fundraiser',
            status: 'published',
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    }),
  );
  await loadRoute(page, 'home', '', browserErrors);
  const banner = page.locator('[data-featured-fundraiser]');
  await banner.waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(page, 'featured fundraiser mobile');
  const details = await banner.evaluate((element) => ({
    title: element.querySelector('[data-featured-title]')?.textContent,
    href: element.querySelector('[data-featured-link]')?.href,
  }));
  assertLayout(
    details.title?.includes('War on the Greens') && details.href?.startsWith('https://'),
    'Featured fundraiser did not render its validated public fields',
    details,
  );
  await banner.getByRole('link', { name: /more info/i }).focus();
  await page.unroute('**/data/featured-fundraiser.json');
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const desktopErrors = [];
  desktop.on('pageerror', (error) => desktopErrors.push(error.message));

  for (const [pageId, route] of routes) {
    await loadRoute(desktop, pageId, route, desktopErrors);
    await assertNoHorizontalOverflow(desktop, `${pageId} desktop`);
  }

  await assertCustomerReportedLayouts(desktop, 'desktop', 1440, desktopErrors);

  await loadRoute(desktop, 'home', '', desktopErrors);
  await desktop.locator('#nb-about').click();
  await desktop.waitForURL(/\/about\/$/);
  await desktop.locator('#page-about.active').waitFor({ state: 'visible' });

  await loadRoute(desktop, 'circle', 'av-circle/', desktopErrors);
  await desktop.locator('[data-panel="indiv"]').click();
  await desktop.locator('#panel-indiv.active').waitFor({ state: 'visible' });

  await loadRoute(desktop, 'warrior', 'warrior-retreat/', desktopErrors);
  await desktop.locator('[data-contact]').first().click();
  await desktop.locator('#contact-modal.open[aria-hidden="false"]').waitFor({ state: 'visible' });
  await desktop.locator('[data-contact-close]').click();
  await desktop.locator('#contact-modal[aria-hidden="true"]').waitFor({ state: 'hidden' });

  await loadRoute(desktop, 'home', '', desktopErrors);
  const homeUrl = desktop.url();
  await desktop.locator('[data-subscribe]').first().click();
  await desktop.locator('#subscribe-modal.open[aria-hidden="false"]').waitFor({ state: 'visible' });
  const subscribeSrc = await desktop.locator('#subscribe-embed').getAttribute('src');
  if (!subscribeSrc?.includes('hDcR5EwOHXT3Uuogr4eR')) {
    throw new Error(`Subscribe modal did not load the GHL form: ${subscribeSrc}`);
  }
  if (desktop.url() !== homeUrl) {
    throw new Error(`Subscribe click navigated away from ${homeUrl} to ${desktop.url()}`);
  }
  await desktop.locator('[data-subscribe-close]').click();
  await desktop.locator('#subscribe-modal[aria-hidden="true"]').waitFor({ state: 'hidden' });
  if (desktop.url() !== homeUrl) {
    throw new Error(`Closing subscribe modal changed the page to ${desktop.url()}`);
  }

  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await mobileContext.newPage();
  await mobile.addInitScript(() => {
    window.__RETREAT_REQUEST_TIMEOUT_MS__ = 100;
  });
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

  await mobile.locator('#search-input').fill('');
  const initialResourceCount = await mobile.locator('#all-grid .res-card:visible').count();
  if (initialResourceCount !== 12) {
    throw new Error(`Resources pagination showed ${initialResourceCount} cards instead of 12.`);
  }
  await mobile.getByRole('button', { name: 'Show more resources' }).click();
  const expandedResourceCount = await mobile.locator('#all-grid .res-card:visible').count();
  if (expandedResourceCount !== 24) {
    throw new Error(`Resources pagination showed ${expandedResourceCount} cards after expansion.`);
  }

  const crisisHref = await mobile.locator('a[href="tel:988"]').first().getAttribute('href');
  if (crisisHref !== 'tel:988') throw new Error('The 988 crisis link is missing.');

  for (const width of [320, 375, 412, 768]) {
    await mobile.setViewportSize({ width, height: 915 });
    await assertCustomerReportedLayouts(mobile, `${width}px`, width, mobileErrors);
  }

  if (retreatLive) {
    await mobile.setViewportSize({ width: 412, height: 915 });
    await assertRetreatSubmissionFailuresAndRetry(mobile);
    await assertRetreatSubmissionTimeout(mobile);
  }
  await assertFeaturedFundraiser(mobile, mobileErrors);

  await mobileContext.close();
  await desktop.close();
  console.log(
    `Browser smoke test passed for ${routes.size} routes and five customer-reported layouts at five responsive widths.`,
  );
} finally {
  await browser.close();
  await stopPreviewServer();
}
