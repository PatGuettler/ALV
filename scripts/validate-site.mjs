import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const masterPath = resolve(projectRoot, 'avactivefinal_compressed.html');
const retreatPath = resolve(projectRoot, 'warrior-retreat-application.html');

const master = await readFile(masterPath, 'utf8');
const retreat = await readFile(retreatPath, 'utf8');

const failures = [];
const requiredPageIds = [
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

for (const pageId of requiredPageIds) {
  if (!master.includes(`id="page-${pageId}"`)) {
    failures.push(`Missing page section: ${pageId}`);
  }
}

for (const requiredText of [
  '<!DOCTYPE html>',
  '<title>Alabama Veteran',
  'function showPage(',
  'tel:988',
  'class="nav-logo"',
]) {
  if (!master.includes(requiredText)) {
    failures.push(`Master site is missing required marker: ${requiredText}`);
  }
}

for (const requiredText of ['<!DOCTYPE html>', 'name="applicant_type"', 'Warrior Retreat']) {
  if (!retreat.includes(requiredText)) {
    failures.push(`Retreat application is missing required marker: ${requiredText}`);
  }
}

if (master.match(/id="page-[^"]+"/g)?.length !== requiredPageIds.length) {
  failures.push('The master site page count changed unexpectedly.');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${requiredPageIds.length} site sections and the retreat application.`);

if (process.env.CHECK_BUILD === '1') {
  const builtIndex = resolve(projectRoot, 'dist', 'index.html');
  await access(builtIndex);
  const builtSize = (await stat(builtIndex)).size;
  const sourceSize = (await stat(masterPath)).size;

  if (builtSize >= sourceSize) {
    console.error('The built HTML was not reduced by asset extraction.');
    process.exit(1);
  }

  console.log(
    `Built HTML reduced from ${(sourceSize / 1024).toFixed(0)} KiB to ` +
      `${(builtSize / 1024).toFixed(0)} KiB.`,
  );
}
