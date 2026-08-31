import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(projectRoot, 'dist');
const reportDirectory = resolve(projectRoot, 'artifacts', 'production');
const manifestPath = resolve(reportDirectory, 'asset-manifest.json');
const forbiddenBasePath = process.env.FORBIDDEN_BASE_PATH || '/AVL/';
const failures = [];
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt', '.xml']);

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

function immutableKey(key) {
  if (key.startsWith('_astro/')) return /\.[A-Za-z0-9_-]{8,}\.[^.]+$/.test(key);
  if (key.startsWith('assets/')) return /^assets\/[a-f0-9]{16}\.[A-Za-z0-9]+$/.test(key);
  return false;
}

function uploadPhase(key, immutable) {
  if (immutable) return 1;
  if (key.endsWith('.html')) return 3;
  return 2;
}

const files = await filesUnder(distRoot);
const entries = [];

for (const path of files) {
  const key = relative(distRoot, path).split(sep).join('/');
  const extension = extname(key).toLowerCase();
  const contentType =
    contentTypes.get(extension) ?? (key === '.nojekyll' ? 'application/octet-stream' : undefined);
  const immutable = immutableKey(key);
  const body = await readFile(path);

  if (!contentType) failures.push(`${key} has no approved content type.`);
  if ((key.startsWith('_astro/') || key.startsWith('assets/')) && !immutable) {
    failures.push(`${key} is in an immutable asset directory without a fingerprinted name.`);
  }
  if (textExtensions.has(extension) && body.toString('utf8').includes(forbiddenBasePath)) {
    failures.push(`${key} contains the staging base path ${forbiddenBasePath}.`);
  }

  entries.push({
    key,
    bytes: (await stat(path)).size,
    sha256: createHash('sha256').update(body).digest('hex'),
    contentType,
    cacheControl: immutable
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
    immutable,
    uploadPhase: uploadPhase(key, immutable),
  });
}

entries.sort(
  (left, right) => left.uploadPhase - right.uploadPhase || left.key.localeCompare(right.key),
);

if (!entries.some(({ key }) => key === 'index.html'))
  failures.push('Production artifact has no index.html.');
if (!entries.some(({ key }) => key === 'robots.txt'))
  failures.push('Production artifact has no robots.txt.');
if (!entries.some(({ key }) => key === 'sitemap-index.xml')) {
  failures.push('Production artifact has no sitemap-index.xml.');
}
if (entries.some(({ key, immutable }) => key.endsWith('.html') && immutable)) {
  failures.push('HTML must never receive an immutable cache policy.');
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'Astro production build',
  uploadContract: [
    { phase: 1, description: 'Upload fingerprinted immutable assets.' },
    { phase: 2, description: 'Upload mutable metadata, robots, and sitemaps.' },
    { phase: 3, description: 'Upload HTML entry points last.' },
  ],
  totals: {
    files: entries.length,
    bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    immutableFiles: entries.filter(({ immutable }) => immutable).length,
    mutableFiles: entries.filter(({ immutable }) => !immutable).length,
  },
  files: entries,
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Packaged ${manifest.totals.files} production objects (${manifest.totals.immutableFiles} immutable, ${manifest.totals.mutableFiles} mutable; ${manifest.totals.bytes} bytes).`,
);
console.log(`Asset manifest: ${manifestPath}`);
