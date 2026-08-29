import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const generatedRoot = resolve(projectRoot, '.generated');
const assetRoot = resolve(generatedRoot, 'assets');
const publicRoot = resolve(generatedRoot, 'public');

const sourcePages = [
  {
    input: resolve(projectRoot, 'avactivefinal_compressed.html'),
    output: resolve(generatedRoot, 'index.html'),
  },
  {
    input: resolve(projectRoot, 'warrior-retreat-application.html'),
    output: resolve(generatedRoot, 'warrior-retreat-application.html'),
  },
];

const mediaTypes = new Map([
  ['jpeg', 'jpg'],
  ['jpg', 'jpg'],
  ['png', 'png'],
  ['webp', 'webp'],
  ['gif', 'gif'],
  ['svg+xml', 'svg'],
]);

await rm(generatedRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(assetRoot, { recursive: true }),
  mkdir(publicRoot, { recursive: true }),
]);

const writtenAssets = new Set();
let extractedReferences = 0;

for (const page of sourcePages) {
  let html = await readFile(page.input, 'utf8');

  const matches = [...html.matchAll(/data:image\/([a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)/g)];
  for (const match of matches) {
    const [, mediaType, base64] = match;
    const extension = mediaTypes.get(mediaType.toLowerCase());

    if (!extension) {
      throw new Error(`Unsupported embedded image type: ${mediaType}`);
    }

    const contents = Buffer.from(base64, 'base64');
    const digest = createHash('sha256').update(contents).digest('hex').slice(0, 16);
    const filename = `${digest}.${extension}`;
    const relativeUrl = `./assets/${filename}`;

    if (!writtenAssets.has(filename)) {
      await writeFile(resolve(assetRoot, filename), contents);
      writtenAssets.add(filename);
    }

    html = html.replaceAll(match[0], relativeUrl);
    extractedReferences += 1;
  }

  await writeFile(page.output, html);
}

await writeFile(resolve(publicRoot, '.nojekyll'), '');

console.log(
  `Prepared ${sourcePages.length} pages with ${writtenAssets.size} cacheable images ` +
    `from ${extractedReferences} embedded references.`,
);

