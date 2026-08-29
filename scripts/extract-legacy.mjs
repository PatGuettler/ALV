import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { load } from 'cheerio';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src');
const masterPath = resolve(projectRoot, 'avactivefinal_compressed.html');
const master = await readFile(masterPath, 'utf8');

const mediaTypes = new Map([
  ['jpeg', 'jpg'],
  ['jpg', 'jpg'],
  ['png', 'png'],
  ['webp', 'webp'],
  ['gif', 'gif'],
  ['svg+xml', 'svg'],
]);

const assetRoot = resolve(sourceRoot, 'assets');
await Promise.all(
  ['assets', 'components', 'pages'].map((directory) =>
    rm(resolve(sourceRoot, directory), { recursive: true, force: true }),
  ),
);
await Promise.all([
  mkdir(assetRoot, { recursive: true }),
  mkdir(resolve(sourceRoot, 'components'), { recursive: true }),
  mkdir(resolve(sourceRoot, 'pages'), { recursive: true }),
  mkdir(resolve(sourceRoot, 'scripts'), { recursive: true }),
  mkdir(resolve(sourceRoot, 'styles'), { recursive: true }),
]);

let preparedHtml = master;
const writtenAssets = new Set();
const embeddedImages = [
  ...master.matchAll(/data:image\/([a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)/g),
];

for (const match of embeddedImages) {
  const [, mediaType, base64] = match;
  const extension = mediaTypes.get(mediaType.toLowerCase());
  if (!extension) throw new Error(`Unsupported embedded image type: ${mediaType}`);

  const contents = Buffer.from(base64, 'base64');
  const digest = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  const filename = `${digest}.${extension}`;

  if (!writtenAssets.has(filename)) {
    await writeFile(resolve(assetRoot, filename), contents);
    writtenAssets.add(filename);
  }

  preparedHtml = preparedHtml.replaceAll(match[0], `__BASE_PATH__assets/${filename}`);
}

const $ = load(preparedHtml);
const styles = $('style')
  .map((_, element) => $(element).html() ?? '')
  .get();
const scripts = $('script')
  .map((_, element) => $(element).html() ?? '')
  .get();
$('style, script').remove();

const components = new Map([
  ['crisis-bar', $('#crisis-bar').first()],
  ['ticker', $('#ticker').first()],
  ['navigation', $('body > nav').first()],
  ['crisis-float', $('.nl-float').first()],
  ['footer', $('body > footer').first()],
  ['contact-modal', $('#contact-modal').first()],
]);

const navigationRoutes = {
  home: '',
  circle: 'av-circle/',
  warrior: 'warrior-retreat/',
  active: 'av-active/',
  events: 'events/',
  resources: 'resources/',
  about: 'about/',
  news: 'news/',
};
const navigation = components.get('navigation');
navigation.find('.nav-logo').attr('href', '__BASE_PATH__').removeAttr('onclick');
navigation.find('button[id^="nb-"]').each((_, element) => {
  const button = $(element);
  const pageId = button.attr('id')?.replace('nb-', '');
  const route = pageId ? navigationRoutes[pageId] : undefined;
  if (route === undefined) return;
  button.replaceWith(`<a href="__BASE_PATH__${route}" id="nb-${pageId}">${button.text()}</a>`);
});

for (const [name, element] of components) {
  if (element.length !== 1) throw new Error(`Expected one ${name} component.`);
  await writeFile(resolve(sourceRoot, 'components', `${name}.html`), $.html(element));
}

const pageIds = [
  'home',
  'news',
  'warrior',
  'circle',
  'about',
  'active',
  'topgolf',
  'events',
  'resources',
];
for (const pageId of pageIds) {
  const page = $(`#page-${pageId}`).first();
  if (page.length !== 1) throw new Error(`Expected one page section for ${pageId}.`);
  page.attr('class', 'page active');
  await writeFile(resolve(sourceRoot, 'pages', `${pageId}.html`), $.html(page));
}

const styleGroups = new Map([
  ['foundation.css', [0]],
  ['navigation.css', [1]],
  ['home.css', [2]],
  ['news.css', [3]],
  ['about.css', [4]],
  ['active.css', [5]],
  ['topgolf.css', [6]],
  ['events.css', [7]],
  ['forms.css', [8, 9]],
  ['resources.css', [10, 11, 12, 13]],
]);

for (const [filename, indexes] of styleGroups) {
  const css = indexes
    .map((index) => styles[index] ?? '')
    .join('\n')
    .replaceAll('__BASE_PATH__assets/', '../assets/');
  await writeFile(resolve(sourceRoot, 'styles', filename), css);
}

const scriptGroups = new Map([
  ['ticker.js', [0]],
  ['events.js', [2]],
  ['forms.js', [3, 4]],
  ['panels.js', [6]],
  ['resources.js', [7]],
]);

for (const [filename, indexes] of scriptGroups) {
  const javascript = indexes.map((index) => scripts[index] ?? '').join('\n');
  await writeFile(resolve(sourceRoot, 'scripts', filename), javascript);
}

const manifest = {
  generatedFrom: 'avactivefinal_compressed.html',
  sourceSha256: createHash('sha256').update(master).digest('hex'),
  pages: pageIds,
  extractedImages: writtenAssets.size,
};
await writeFile(
  resolve(sourceRoot, 'legacy-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  `Extracted ${pageIds.length} pages, ${components.size} shared components, and ${writtenAssets.size} images.`,
);
