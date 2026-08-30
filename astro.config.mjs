import { defineConfig } from 'astro/config';

const requestedBase = process.env.BASE_PATH || '/';
const trimmedBase = requestedBase.replace(/^\/+|\/+$/g, '');
const base = trimmedBase ? `/${trimmedBase}` : '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://patguettler.github.io',
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
