# Web performance baseline and budget

This document records the reproducible laboratory baseline for the public static site. The
customer-facing backlog remains the source of truth for delivery scope and follow-up work.

## Test conditions

- Lighthouse 13.4.1 with simulated throttling against a local production Astro build.
- Mobile preset on the homepage and desktop preset on the resource directory.
- Chrome runs headlessly on the same Linux environment used by the browser checks.
- The report is written to `artifacts/performance/lighthouse-budget-report.json` and retained by the
  GitHub Pages workflow.

Observed runs after prioritizing the shared hero media:

| Profile            | Performance score |         LCP | CLS |  TBT | Transfer |
| ------------------ | ----------------: | ----------: | --: | ---: | -------: |
| Homepage, mobile   |         0.94–0.99 | 2.04–2.67 s |   0 | 0 ms |  250 KiB |
| Resources, desktop |              0.99 | 1.99–2.01 s |   0 | 0 ms |  161 KiB |

The largest observed image is the shared 900 by 900 WebP hero at about 78 KiB. The largest font is
about 29 KiB, the largest stylesheet about 13 KiB, and the largest script about 12 KiB.

## Budgets

- Production field targets: LCP at or below 2.5 seconds, CLS at or below 0.1, and INP at or below
  200 milliseconds at the 75th percentile.
- CI Lighthouse regression ceiling: LCP at or below 3.0 seconds and performance score at or above
  0.90. The separate 3.0-second ceiling accounts for network variance while the shared hero remains
  hosted by the current site; it does not replace the 2.5-second production target.
- TBT at or below 200 milliseconds is the laboratory proxy for responsiveness. Lighthouse cannot
  produce real-user INP, so production telemetry must enforce the INP target after launch.
- Total transfer at or below 1.5 MiB. Largest image 400 KiB, font 150 KiB, stylesheet 200 KiB, and
  script 150 KiB.

Issue #244 tracks customer approval to copy the current externally hosted hero into the governed
production asset set and remove the legacy WordPress dependency. Any future budget failure must be
represented by a focused ALV issue before a threshold is changed.
