import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src');
const masterPath = resolve(projectRoot, 'avactivefinal_compressed.html');
const retreatPath = resolve(projectRoot, 'warrior-retreat-application.html');
const master = await readFile(masterPath, 'utf8');
const retreat = await readFile(retreatPath, 'utf8');
const manifest = JSON.parse(await readFile(resolve(sourceRoot, 'legacy-manifest.json'), 'utf8'));

const failures = [];
const pages = new Map([
  ['home', ''],
  ['news', 'news'],
  ['warrior', 'warrior-retreat'],
  ['circle', 'av-circle'],
  ['active', 'av-active'],
  ['topgolf', 'topgolf'],
  ['events', 'events'],
  ['resources', 'resources'],
  ['about', 'about'],
]);

const masterDigest = createHash('sha256').update(master).digest('hex');
if (manifest.sourceSha256 !== masterDigest) {
  failures.push('The modular source is out of sync with the approved baseline.');
}

for (const pageId of pages.keys()) {
  const source = await readFile(resolve(sourceRoot, 'pages', `${pageId}.html`), 'utf8');
  if (!source.includes(`id="page-${pageId}"`)) failures.push(`Missing modular page: ${pageId}`);
  if (source.includes('<style') || source.includes('<script')) {
    failures.push(`${pageId} contains inline style or script elements.`);
  }
  if (source.includes('data:image/')) failures.push(`${pageId} contains an embedded image.`);
}

for (const component of [
  'crisis-bar',
  'ticker',
  'navigation',
  'crisis-float',
  'footer',
  'contact-modal',
]) {
  await access(resolve(sourceRoot, 'components', `${component}.html`));
}

for (const script of ['ticker', 'navigation', 'forms', 'panels', 'events', 'resources']) {
  const javascript = await readFile(resolve(sourceRoot, 'scripts', `${script}.js`), 'utf8');
  try {
    new Function(javascript);
  } catch (error) {
    failures.push(`${script}.js has invalid syntax: ${error.message}`);
  }
}

for (const requiredText of ['<!DOCTYPE html>', 'name="applicant_type"', 'Warrior Retreat']) {
  if (!retreat.includes(requiredText)) {
    failures.push(`Retreat application is missing required marker: ${requiredText}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Validated ${pages.size} modular pages, shared components, scripts, and the retreat application.`,
);

if (process.env.CHECK_BUILD === '1') {
  for (const [pageId, route] of pages) {
    const output = route
      ? resolve(projectRoot, 'dist', route, 'index.html')
      : resolve(projectRoot, 'dist', 'index.html');
    const html = await readFile(output, 'utf8');
    if (!html.includes(`id="page-${pageId}"`)) failures.push(`Built route is incorrect: ${pageId}`);
    if (html.includes('data:image/'))
      failures.push(`Built route contains embedded images: ${pageId}`);
  }

  const builtIndex = resolve(projectRoot, 'dist', 'index.html');
  const builtSize = (await stat(builtIndex)).size;
  if (builtSize > 100 * 1024)
    failures.push('The homepage HTML exceeds its 100 KiB performance budget.');

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(
    `Validated ${pages.size} built routes; homepage HTML is ${(builtSize / 1024).toFixed(0)} KiB.`,
  );
}
