# Alabama Veteran developer handoff

The deployable site is the component-based Astro project in `src/`; there is no WordPress or
single-file HTML deployment path. Start with [README.md](README.md) for local commands and repository
structure.

## Current deployment boundaries

- GitHub Pages is public visual staging. `.github/workflows/pages.yml` builds, validates, tests in a
  real browser, and deploys every merge to `main`.
- AWS production identity for **this product** is the ALV member accounts under the KeyTrain org.
  Live IDs, login URLs, and Terraform commands are in
  [PRODUCTION_PLAN.md — Current AWS status](PRODUCTION_PLAN.md#current-aws-status-2026-08-31--pick-up-here).
  Org Terraform: `infra/live/org`. Do not apply ALV website roots to the KeyTrain payer.
- [MOCK_DATA_AUDIT.md](MOCK_DATA_AUDIT.md) records every removed prototype behavior and its required
  production replacement.
- `/warrior-retreat-application/` posts to the ALV prod API when `src/config/retreat.js` is populated.
  `/warrior-retreat-staff/` is invite-only Cognito login for operators. GitHub Pages still must not
  ship secrets, mock applicants, or passcodes.

## Required checks

```bash
npm ci
npm run format:check
npm run check
npm test
BASE_PATH=/ALV npm run build
CHECK_BUILD=1 npm run test:site
BASE_PATH=/ALV node scripts/browser-smoke.mjs
```

Do not add secrets, private submissions, staff credentials, test people, simulated success states,
or hard-coded event feeds to the public source. Dynamic data must come from the production system of
record and return a durable record ID before the UI reports success.
