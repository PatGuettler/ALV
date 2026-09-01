# Alabama Veteran developer handoff

The deployable site is the component-based Astro project in `src/`; there is no WordPress or
single-file HTML deployment path. Start with [README.md](README.md) for local commands and repository
structure.

## Current deployment boundaries

- GitHub Pages is public visual staging. `.github/workflows/pages.yml` builds, validates, tests in a
  real browser, and deploys every merge to `main`.
- AWS is the selected production platform. [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) defines accounts,
  Terraform, IAM, identity, APIs, DynamoDB, calendars, signups, security, and delivery phases.
- [MOCK_DATA_AUDIT.md](MOCK_DATA_AUDIT.md) records every removed prototype behavior and its required
  production replacement.
- `/warrior-retreat-application/` intentionally collects nothing until the secure application and
  staff-review infrastructure exists.

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
