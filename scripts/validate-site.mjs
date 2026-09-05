import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { retreatLive } from '../src/config/retreat.js';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src');
const failures = [];

const routes = new Map([
  ['home', { source: 'index.astro', output: 'index.html' }],
  ['news', { source: 'news.astro', output: 'news/index.html' }],
  ['warrior', { source: 'warrior-retreat.astro', output: 'warrior-retreat/index.html' }],
  ['circle', { source: 'av-circle.astro', output: 'av-circle/index.html' }],
  ['active', { source: 'av-active.astro', output: 'av-active/index.html' }],
  ['topgolf', { source: 'topgolf.astro', output: 'topgolf/index.html' }],
  ['events', { source: 'events.astro', output: 'events/index.html' }],
  ['resources', { source: 'resources.astro', output: 'resources/index.html' }],
  ['about', { source: 'about.astro', output: 'about/index.html' }],
]);

const sectionCounts = new Map([
  ['home', 11],
  ['news', 1],
  ['warrior', 3],
  ['circle', 9],
  ['about', 4],
  ['active', 6],
  ['topgolf', 2],
  ['events', 7],
  ['resources', 5],
]);

const forbiddenPrototypeMarkers = [
  'sampleApps',
  'ADMIN_PASSCODE',
  'AV_EVENTS',
  'AV_FUNDRAISERS',
  'Thanks — you’re on the list',
  'return avSignup',
  'Beta Testing Now',
  'Coming Soon',
  'Sarah M., Birmingham',
  'Robert L., Huntsville',
  'David P., Tuscaloosa',
  '2026-10-19',
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return nested.flat();
}

const sourceFiles = await filesUnder(sourceRoot);
const astroFiles = sourceFiles.filter((path) => extname(path) === '.astro');
const htmlFiles = sourceFiles.filter((path) => extname(path) === '.html');

if (htmlFiles.length > 0) failures.push(`Legacy HTML source files remain: ${htmlFiles.join(', ')}`);

for (const [pageId, route] of routes) {
  const source = await readFile(resolve(sourceRoot, 'pages', route.source), 'utf8');
  if (!source.includes('<SiteLayout')) failures.push(`${pageId} does not use SiteLayout.`);
  if (!source.includes(`id="page-${pageId}"`)) failures.push(`${pageId} is missing its page root.`);

  const componentDirectory = resolve(sourceRoot, 'components', pageId);
  const components = (await readdir(componentDirectory)).filter((name) => name.endsWith('.astro'));
  if (components.length !== sectionCounts.get(pageId)) {
    failures.push(
      `${pageId} should have ${sectionCounts.get(pageId)} section components; found ${components.length}.`,
    );
  }
}

for (const path of astroFiles) {
  const source = await readFile(path, 'utf8');
  if (source.includes('data:image/')) failures.push(`${path} contains an embedded image.`);
  for (const marker of forbiddenPrototypeMarkers) {
    if (source.includes(marker)) failures.push(`${path} contains removed marker: ${marker}`);
  }
}

for (const script of [
  'navigation',
  'forms',
  'panels',
  'resources',
  'retreat-application',
  'retreat-staff',
  'featured-fundraiser',
  'events-calendar',
]) {
  const scriptPath = resolve(sourceRoot, 'scripts', `${script}.js`);
  const javascript = await readFile(scriptPath, 'utf8');
  const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    failures.push(
      `${script}.js has invalid syntax: ${(syntax.stderr || syntax.stdout).trim() || 'node --check failed'}`,
    );
  }
  for (const marker of forbiddenPrototypeMarkers) {
    if (javascript.includes(marker))
      failures.push(`${script}.js contains removed marker: ${marker}`);
  }
}

const retreatPage = await readFile(
  resolve(sourceRoot, 'components', 'retreat', 'ServiceUnavailable.astro'),
  'utf8',
);
if (!retreatPage.includes('Application service not connected')) {
  failures.push('The retreat service status component is missing.');
}

const footer = await readFile(resolve(sourceRoot, 'components', 'site', 'Footer.astro'), 'utf8');
if (!footer.includes('https://va.alabama.gov/service-officer')) {
  failures.push('Footer Find a VSO must use the current ADVA service-officer URL.');
}
if (footer.includes('va.alabama.gov/serviceofficer/')) {
  failures.push('Footer still points at the retired ADVA serviceofficer URL.');
}

const sponsors = await readFile(
  resolve(sourceRoot, 'components', 'home', 'Sponsors.astro'),
  'utf8',
);
if ((sponsors.match(/loading="lazy"/g) || []).length < 2) {
  failures.push('Homepage sponsor logos must load lazily so they do not compete with LCP.');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Validated ${routes.size} Astro routes, ${astroFiles.length} components/layouts, and client modules.`,
);

if (process.env.CHECK_BUILD === '1') {
  for (const [pageId, route] of routes) {
    const html = await readFile(resolve(projectRoot, 'dist', route.output), 'utf8');
    if (!html.includes(`id="page-${pageId}"`)) failures.push(`Built route is incorrect: ${pageId}`);
    if (html.includes('data:image/')) failures.push(`Built route embeds images: ${pageId}`);
    for (const marker of forbiddenPrototypeMarkers) {
      if (html.includes(marker)) failures.push(`Built route ${pageId} contains: ${marker}`);
    }
  }

  const builtRetreat = await readFile(
    resolve(projectRoot, 'dist', 'warrior-retreat-application', 'index.html'),
    'utf8',
  );
  const retreatHeading = retreatLive
    ? 'Warrior Retreat Application'
    : 'Application service not connected';
  if (!builtRetreat.includes(retreatHeading)) {
    failures.push('Built retreat application route is incorrect.');
  }

  const builtStaff = await readFile(
    resolve(projectRoot, 'dist', 'warrior-retreat-staff', 'index.html'),
    'utf8',
  );
  const staffHeading = retreatLive ? 'Retreat Administration' : 'Application service not connected';
  if (!builtStaff.includes(staffHeading)) {
    failures.push('Built retreat staff route is incorrect.');
  }

  const builtIndex = resolve(projectRoot, 'dist', 'index.html');
  const builtSize = (await stat(builtIndex)).size;
  if (builtSize > 100 * 1024) failures.push('The homepage HTML exceeds its 100 KiB budget.');

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(
    `Validated ${routes.size + 1} built routes; homepage HTML is ${(builtSize / 1024).toFixed(0)} KiB.`,
  );
}
