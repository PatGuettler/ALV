import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src');
const generatedRoot = resolve(projectRoot, '.generated');
const publicRoot = resolve(generatedRoot, 'public');
const masterPath = resolve(projectRoot, 'avactivefinal_compressed.html');

const pageDefinitions = {
  home: {
    route: '',
    title: "Alabama Veteran — We've Got Your Six",
    description:
      'Serving Alabama veterans through community, resources, retreats, and direct support.',
    styles: ['home.css'],
  },
  news: {
    route: 'news',
    title: 'AV News | Alabama Veteran',
    description: 'News and updates from Alabama Veteran.',
    styles: ['news.css'],
  },
  warrior: {
    route: 'warrior-retreat',
    title: 'Warrior Retreat | Alabama Veteran',
    description: 'Retreat programs and peer support for Alabama veterans and their families.',
  },
  circle: {
    route: 'av-circle',
    title: 'AV Circle | Alabama Veteran',
    description: 'Join the Alabama Veteran community of individual and corporate supporters.',
    scripts: ['panels.js'],
  },
  about: {
    route: 'about',
    title: 'About | Alabama Veteran',
    description: 'Learn about the mission, values, and leadership of Alabama Veteran.',
    styles: ['about.css'],
  },
  active: {
    route: 'av-active',
    title: 'AV Active | Alabama Veteran',
    description: 'Community, activity, and wellness programming built for Alabama veterans.',
    styles: ['active.css'],
  },
  topgolf: {
    route: 'topgolf',
    title: 'Topgolf for Veterans | Alabama Veteran',
    description: 'Free Topgolf programming for Alabama veterans.',
    styles: ['topgolf.css'],
  },
  events: {
    route: 'events',
    title: 'Events | Alabama Veteran',
    description: 'Upcoming Alabama Veteran fundraisers, community programs, and events.',
    styles: ['events.css'],
    scripts: ['events.js'],
  },
  resources: {
    route: 'resources',
    title: 'Veteran Resources | Alabama Veteran',
    description:
      'Search trusted benefits, crisis, housing, employment, and community resources for Alabama veterans.',
    styles: ['resources.css'],
    scripts: ['resources.js'],
    hideTicker: true,
  },
};

const requestedBase = process.env.BASE_PATH || '/';
const trimmedBase = requestedBase.replace(/^\/+|\/+$/g, '');
const basePath = trimmedBase ? `/${trimmedBase}/` : '/';

await rm(generatedRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });

const master = await readFile(masterPath, 'utf8');
const manifest = JSON.parse(await readFile(resolve(sourceRoot, 'legacy-manifest.json'), 'utf8'));
const masterDigest = createHash('sha256').update(master).digest('hex');
if (manifest.sourceSha256 !== masterDigest) {
  throw new Error(
    'The approved baseline changed. Run `npm run extract:legacy` and review the generated source modules.',
  );
}

await Promise.all([
  cp(resolve(sourceRoot, 'assets'), resolve(publicRoot, 'assets'), { recursive: true }),
  cp(resolve(sourceRoot, 'styles'), resolve(publicRoot, 'styles'), { recursive: true }),
  cp(resolve(sourceRoot, 'scripts'), resolve(publicRoot, 'scripts'), { recursive: true }),
]);
await writeFile(resolve(publicRoot, '.nojekyll'), '');

const componentNames = [
  'crisis-bar',
  'ticker',
  'navigation',
  'crisis-float',
  'footer',
  'contact-modal',
];
const components = Object.fromEntries(
  await Promise.all(
    componentNames.map(async (name) => [
      name,
      await readFile(resolve(sourceRoot, 'components', `${name}.html`), 'utf8'),
    ]),
  ),
);

const commonStyles = ['foundation.css', 'navigation.css', 'forms.css'];
const commonScripts = ['ticker.js', 'navigation.js', 'forms.js'];

for (const [pageId, definition] of Object.entries(pageDefinitions)) {
  const page = await readFile(resolve(sourceRoot, 'pages', `${pageId}.html`), 'utf8');
  const styles = [...commonStyles, ...(definition.styles ?? []), 'responsive.css'];
  const scripts = [...commonScripts, ...(definition.scripts ?? [])];
  const ticker = definition.hideTicker ? '' : components.ticker;
  const canonicalUrl = `https://alabamaveteran.org/${definition.route}${definition.route ? '/' : ''}`;

  const html = `<!doctype html>
<html lang="en" data-base-path="${basePath}" data-page="${pageId}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="${definition.description}">
    <meta name="theme-color" content="#1A2030">
    <link rel="canonical" href="${canonicalUrl}">
    <title>${definition.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=League+Gothic&family=Libre+Franklin:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
${styles.map((filename) => `    <link rel="stylesheet" href="/styles/${filename}">`).join('\n')}
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
${components['crisis-bar']}
${components.navigation}
${ticker}
    <main id="main-content">
${page}
    </main>
${components.footer}
${components['crisis-float']}
${components['contact-modal']}
${scripts.map((filename) => `    <script src="/scripts/${filename}" defer></script>`).join('\n')}
  </body>
</html>
`
    .replaceAll('__BASE_PATH__assets/', '/assets/')
    .replaceAll('__BASE_PATH__', basePath)
    .replaceAll(
      'href="warrior-retreat-application.html"',
      `href="${basePath}warrior-retreat-application.html"`,
    );

  const outputDirectory = definition.route
    ? resolve(generatedRoot, definition.route)
    : generatedRoot;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, 'index.html'), html);
}

// The retreat application remains a standalone customer artifact for now.
let retreat = await readFile(resolve(projectRoot, 'warrior-retreat-application.html'), 'utf8');
const embeddedImages = [
  ...retreat.matchAll(/data:image\/([a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)/g),
];
for (const match of embeddedImages) {
  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const contents = Buffer.from(match[2], 'base64');
  const digest = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  const filename = `${digest}.${extension}`;
  await writeFile(resolve(publicRoot, 'assets', filename), contents);
  retreat = retreat.replaceAll(match[0], `/assets/${filename}`);
}
await writeFile(resolve(generatedRoot, 'warrior-retreat-application.html'), retreat);

console.log(`Prepared ${Object.keys(pageDefinitions).length} routes at base path ${basePath}.`);
