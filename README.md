# Alabama Veteran website

This repository contains the approved Alabama Veteran website concept as a responsive,
component-based Astro site. Astro file-based routes import small page sections and a shared site
layout; there is no hand-maintained all-in-one HTML source.

## Local development

Requirements: Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Astro prints the local preview URL. `/warrior-retreat-application/` intentionally displays an
unavailable state until its secure production workflow is deployed.

## Project structure

```text
src/
├── components/
│   ├── site/       Shared navigation, crisis controls, footer, and contact modal
│   ├── home/       Named homepage sections
│   └── */          Named sections owned by each feature page
├── layouts/        Shared full-document and minimal page shells
├── pages/          Thin Astro file-based routes; no page markup monoliths
├── styles/         Foundation, feature, page, and responsive stylesheets
└── scripts/        Small client modules for menu, contact, panels, and resource search
public/
└── assets/         Public content-hashed images copied unchanged by Astro
```

Public routes include `/`, `/about/`, `/av-active/`, `/av-circle/`, `/events/`, `/news/`, `/resources/`, `/topgolf/`, and `/warrior-retreat/`.

## Validation and production build

```bash
npm test
npm run check
npm run build
CHECK_BUILD=1 npm run test:site
npm run test:browser
npm run preview
```

The deployable output is written to `dist/`. Generated files, dependencies, and build output are intentionally excluded from git.

The browser smoke test uses an installed Chrome or Chromium. Set `CHROME_PATH` if the browser is not in a standard location.

## Source-of-truth files

- `src/pages/` owns routing and page metadata. Route files should remain small composition roots.
- `src/layouts/SiteLayout.astro` owns the document shell and shared site chrome.
- `src/components/<feature>/` owns one semantic section per component.
- `src/pages/warrior-retreat-application.astro` is the safe staging route. The discarded concept
  included fictional applicants and browser-only authentication and must not be restored.
- `astro.config.mjs` owns the GitHub Pages base path and static directory output.

The duplicate monolithic concept files and archive package were removed after migration because they
contained prototype records and simulated behavior. Git history retains the original customer
handoff if a visual comparison is ever required.

## GitHub Pages staging

The workflow in `.github/workflows/pages.yml` type-checks, validates, builds, browser-tests, and
deploys `main` to GitHub Pages. In the GitHub repository, open **Settings → Pages** and set **Source**
to **GitHub Actions** once. Then run the workflow manually or push to `main`.

No secrets or private customer data may be added to this static site. GitHub Pages is a public staging environment.

## Project estimate rollups

The `Time (hours)` field in the ALV GitHub Project is maintained by
`.github/workflows/project-time-rollup.yml`. Estimates are entered only on issues without
sub-issues. Every issue with children is a calculated value, and the workflow rolls nested
hierarchies up from the lowest level every 15 minutes. It can also be run manually with a dry-run
option. Estimates are ordinary working hours; the original person-day estimates were converted at
eight hours per person-day.

The workflow requires a repository Actions secret named `PROJECTS_TOKEN`. Use a dedicated
fine-grained personal access token owned by a project administrator, with read access to ALV issues
and read/write access to the user's Projects. Do not reuse a broad developer or AWS credential. If
GitHub's fine-grained token UI does not offer write access to the user-owned project, use a classic
token limited to the `project` scope and set an expiration/rotation reminder.

Configure the secret under **ALV → Settings → Secrets and variables → Actions**, then run
**Roll up project time estimates** once with `dry_run` enabled and once normally. Missing leaf
estimates, missing project children, and hierarchy cycles fail safely without partially calculating
new totals.

For a local dry run with an authenticated GitHub CLI token:

```bash
ALV_PROJECT_TOKEN=$(gh auth token)
GH_TOKEN="$ALV_PROJECT_TOKEN" node scripts/project-time-rollup.mjs --dry-run
unset ALV_PROJECT_TOKEN
```

For the AWS architecture, Terraform inventory, IAM boundaries, data model, and migration phases, see
[PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md). The precise list of removed prototype data and each
production replacement is in [MOCK_DATA_AUDIT.md](./MOCK_DATA_AUDIT.md).
