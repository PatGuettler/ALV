# Alabama Veteran website

This repository contains the approved Alabama Veteran website concept and a reproducible static staging build. The staging build deliberately preserves the approved HTML, CSS, JavaScript, navigation, and imagery while moving embedded images into independently cacheable files.

## Local development

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Vite prints the local preview URL. The standalone Warrior Retreat application is available at `/warrior-retreat-application.html`.

## Validation and production build

```bash
npm test
npm run build
CHECK_BUILD=1 npm run test:site
npm run test:browser
npm run preview
```

The deployable output is written to `dist/`. Generated files, dependencies, and build output are intentionally excluded from git.

The browser smoke test uses an installed Chrome or Chromium. Set `CHROME_PATH` if the browser is not in a standard location.

## Source-of-truth files

- `avactivefinal_compressed.html` is the approved website baseline identified by the customer handoff.
- `warrior-retreat-application.html` is the standalone retreat application baseline.
- `scripts/prepare-site.mjs` creates the optimized input consumed by Vite. It does not modify either baseline.

Keeping the customer artifact immutable makes visual comparisons straightforward and avoids accidental changes while the staging site is under review.

## GitHub Pages staging

The workflow in `.github/workflows/pages.yml` validates, builds, and deploys `main` to GitHub Pages. In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions** once. Then run the workflow manually or push to `main`.

No secrets or private customer data may be added to this static site. GitHub Pages is a public staging environment.

For the recommended production architecture and migration phases, see [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md).
