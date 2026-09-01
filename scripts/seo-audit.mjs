import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(projectRoot, 'dist');
const productionOrigin = 'https://alabamaveteran.org/';
const production = process.env.SITE_ENV === 'production';
const base = (process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '');
const sitemapOrigin = process.env.SITE_URL || 'https://patguettler.github.io';
const sitemapBase = new URL(`${base ? `${base}/` : ''}`, `${sitemapOrigin}/`);
const failures = [];
const routes = [
  '',
  'news/',
  'warrior-retreat/',
  'av-circle/',
  'about/',
  'av-active/',
  'topgolf/',
  'events/',
  'resources/',
];

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(([tag]) => tag);
}

function decodeEntities(value) {
  return value
    ?.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return decodeEntities(match?.[1] ?? match?.[2]);
}

function metaContent(html, key, value) {
  const tag = tags(html, 'meta').find((candidate) => attribute(candidate, key) === value);
  return tag ? attribute(tag, 'content') : undefined;
}

function linkHref(html, rel) {
  const tag = tags(html, 'link').find((candidate) => attribute(candidate, 'rel') === rel);
  return tag ? attribute(tag, 'href') : undefined;
}

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();

for (const route of routes) {
  const html = await readFile(resolve(distRoot, route, 'index.html'), 'utf8');
  const title = decodeEntities(html.match(/<title>([^<]+)<\/title>/i)?.[1]);
  const description = metaContent(html, 'name', 'description');
  const canonical = linkHref(html, 'canonical');
  const expectedCanonical = new URL(route, productionOrigin).href;
  const robots = metaContent(html, 'name', 'robots');
  const structuredData = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
  )?.[1];
  const h1Count = html.match(/<h1\b/gi)?.length ?? 0;

  if (!title) failures.push(`${route || '/'} has no title.`);
  if (!description) failures.push(`${route || '/'} has no meta description.`);
  if (h1Count !== 1) failures.push(`${route || '/'} has ${h1Count} h1 headings; expected one.`);
  if (canonical !== expectedCanonical) {
    failures.push(
      `${route || '/'} canonical is ${canonical || 'missing'}; expected ${expectedCanonical}.`,
    );
  }
  if (!linkHref(html, 'icon')) failures.push(`${route || '/'} has no favicon declaration.`);
  if (metaContent(html, 'property', 'og:title') !== title) {
    failures.push(`${route || '/'} Open Graph title does not match the page title.`);
  }
  if (metaContent(html, 'property', 'og:description') !== description) {
    failures.push(`${route || '/'} Open Graph description does not match the page description.`);
  }
  if (metaContent(html, 'property', 'og:url') !== canonical) {
    failures.push(`${route || '/'} Open Graph URL does not match the canonical URL.`);
  }
  if (!metaContent(html, 'property', 'og:image')) {
    failures.push(`${route || '/'} has no Open Graph image.`);
  }
  if (metaContent(html, 'name', 'twitter:card') !== 'summary_large_image') {
    failures.push(`${route || '/'} has no large Twitter card declaration.`);
  }
  if (production ? robots?.includes('noindex') : robots !== 'noindex, nofollow') {
    failures.push(
      `${route || '/'} has incorrect ${production ? 'production' : 'staging'} robots metadata.`,
    );
  }

  try {
    const graph = JSON.parse(structuredData)?.['@graph'];
    if (!Array.isArray(graph) || !graph.some((entry) => entry['@type'] === 'WebPage')) {
      failures.push(`${route || '/'} has no supported WebPage structured data.`);
    }
  } catch {
    failures.push(`${route || '/'} has invalid JSON-LD structured data.`);
  }

  if (title) titles.set(route, title);
  if (description) descriptions.set(route, description);
  if (canonical) canonicals.set(route, canonical);
}

for (const [label, values] of [
  ['titles', titles],
  ['descriptions', descriptions],
  ['canonical URLs', canonicals],
]) {
  if (new Set(values.values()).size !== routes.length) {
    failures.push(`Public page ${label} are not unique.`);
  }
}

const unavailableHtml = await readFile(
  resolve(distRoot, 'warrior-retreat-application', 'index.html'),
  'utf8',
);
if (!metaContent(unavailableHtml, 'name', 'robots')?.includes('noindex')) {
  failures.push('The unavailable retreat application route must remain noindex.');
}

const robots = await readFile(resolve(distRoot, 'robots.txt'), 'utf8');
if (production) {
  if (!robots.includes('Allow: /') || !robots.includes('Sitemap:')) {
    failures.push('Production robots.txt must allow crawling and advertise the sitemap.');
  }
} else if (!robots.includes('Disallow: /')) {
  failures.push('Staging robots.txt must disallow crawling.');
}

await access(resolve(distRoot, 'sitemap-index.xml'));
const sitemap = await readFile(resolve(distRoot, 'sitemap-0.xml'), 'utf8');
for (const route of routes) {
  const expectedUrl = new URL(route, sitemapBase).href;
  if (!sitemap.includes(expectedUrl)) failures.push(`Sitemap is missing ${expectedUrl}.`);
}
if (sitemap.includes('warrior-retreat-application')) {
  failures.push('Sitemap includes the noindex retreat application route.');
}
if (sitemap.includes('warrior-retreat-staff')) {
  failures.push('Sitemap includes the noindex retreat staff route.');
}

const staffHtml = await readFile(resolve(distRoot, 'warrior-retreat-staff', 'index.html'), 'utf8');
if (!metaContent(staffHtml, 'name', 'robots')?.includes('noindex')) {
  failures.push('The retreat staff route must remain noindex.');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `SEO audit passed ${routes.length} indexable routes plus the noindex application status route (${production ? 'production' : 'staging'} mode).`,
);
