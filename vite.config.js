import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const generatedRoot = resolve(import.meta.dirname, '.generated');

export default defineConfig({
  root: generatedRoot,
  base: process.env.BASE_PATH || '/',
  publicDir: resolve(generatedRoot, 'public'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(generatedRoot, 'index.html'),
        'warrior-retreat-application': resolve(
          generatedRoot,
          'warrior-retreat-application.html',
        ),
      },
    },
  },
});

