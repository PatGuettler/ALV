import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const requestedBase = process.env.BASE_PATH || '/';
const trimmedBase = requestedBase.replace(/^\/+|\/+$/g, '');
const base = trimmedBase ? `/${trimmedBase}` : '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://patguettler.github.io',
  base,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/warrior-retreat-application/'),
    }),
  ],
  build: {
    format: 'directory',
  },
});
