# Alabama Veteran website

This repository contains the approved Alabama Veteran website concept and a maintainable, responsive, multi-page static implementation. Shared components, page content, styles, scripts, and images live in separate source modules and produce independently addressable routes.

## Local development

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Vite prints the local preview URL. The standalone Warrior Retreat application is available at `/warrior-retreat-application.html`.

## Project structure

```text
src/
├── components/   Shared navigation, crisis controls, footer, and modal
├── pages/        One HTML content module per public route
├── styles/       Foundation, feature, page, and responsive stylesheets
├── scripts/      Navigation, forms, events, resources, and page behavior
└── assets/       Content-hashed, independently cacheable images
```

Public routes include `/`, `/about/`, `/av-active/`, `/av-circle/`, `/events/`, `/news/`, `/resources/`, `/topgolf/`, and `/warrior-retreat/`.

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
- `src/` is the maintainable website source used for builds.
- `scripts/prepare-site.mjs` composes shared components and pages into the optimized input consumed by Vite.
- `scripts/extract-legacy.mjs` is a controlled migration utility. Run `npm run extract:legacy` only when intentionally importing a revised approved baseline, then review the resulting source changes.

The manifest in `src/legacy-manifest.json` ties the modular source to the approved baseline. The build fails if that baseline changes without an explicit extraction and review.

## GitHub Pages staging

The workflow in `.github/workflows/pages.yml` validates, builds, and deploys `main` to GitHub Pages. In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions** once. Then run the workflow manually or push to `main`.

No secrets or private customer data may be added to this static site. GitHub Pages is a public staging environment.

For the recommended production architecture and migration phases, see [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md).
