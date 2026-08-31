import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const isProduction = import.meta.env.SITE_ENV === 'production';
  const base = import.meta.env.BASE_URL.replace(/^\/+|\/+$/g, '');
  const sitemapPath = `${base ? `${base}/` : ''}sitemap-index.xml`;
  const sitemapUrl = new URL(sitemapPath, site ?? 'https://alabamaveteran.org/');
  const directives = isProduction
    ? ['User-agent: *', 'Allow: /', `Sitemap: ${sitemapUrl.href}`]
    : ['User-agent: *', 'Disallow: /'];

  return new Response(`${directives.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
