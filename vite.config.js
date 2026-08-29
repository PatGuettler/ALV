import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const generatedRoot = resolve(import.meta.dirname, '.generated');
const trimmedBase = (process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '');
const base = trimmedBase ? `/${trimmedBase}/` : '/';

export default defineConfig({
  root: generatedRoot,
  base,
  publicDir: resolve(generatedRoot, 'public'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(generatedRoot, 'index.html'),
        about: resolve(generatedRoot, 'about', 'index.html'),
        active: resolve(generatedRoot, 'av-active', 'index.html'),
        circle: resolve(generatedRoot, 'av-circle', 'index.html'),
        events: resolve(generatedRoot, 'events', 'index.html'),
        news: resolve(generatedRoot, 'news', 'index.html'),
        resources: resolve(generatedRoot, 'resources', 'index.html'),
        topgolf: resolve(generatedRoot, 'topgolf', 'index.html'),
        warrior: resolve(generatedRoot, 'warrior-retreat', 'index.html'),
        'warrior-retreat-application': resolve(generatedRoot, 'warrior-retreat-application.html'),
      },
    },
  },
});
