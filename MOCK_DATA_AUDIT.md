# Mock data and simulated behavior audit

This file records what was removed from the customer concept, what remains intentionally static,
and which production service must replace each removed area. It is also the acceptance checklist for
preventing prototype behavior from returning to public staging.

## Removed from the public build

| Area                        | Removed prototype behavior or data                                                                                                      | What staging does now                                      | Production owner                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Warrior Retreat application | Eight fictional applicants with names, phone numbers, health information, statuses, retreat sessions, dashboard totals, and CSV exports | Displays an explicit unavailable page and collects nothing | `applications` API, DynamoDB application table, private S3 uploads, Cognito staff portal              |
| Staff login                 | Shared passcode embedded in JavaScript and client-side admin reveal                                                                     | No login control or admin records are shipped              | Cognito managed login, invite-only users, MFA/passkeys, API Gateway JWT scopes                        |
| ID.me                       | Buttons that visually simulated a completed verification without calling ID.me                                                          | No verification claim or control is shown                  | Optional contracted ID.me OAuth/OIDC integration implemented server-side after vendor approval        |
| Retreat submission          | Form advanced to a success screen but did not save or send an application                                                               | No application form is enabled                             | API Gateway, validation Lambda, DynamoDB conditional write, SQS, SES receipt                          |
| Event calendar              | Hard-coded 2026 records, fixed month, invented/past dates, static calendar links, and a fundraiser ticker                               | Events page has an honest empty state                      | Events API, DynamoDB events/registrations, staff publishing UI, iCalendar feed, EventBridge Scheduler |
| Newsletter                  | JavaScript hid the form and displayed “you’re on the list” without storing consent                                                      | Email fields and fake success state are absent             | Subscription API, consent ledger, SES contact list or approved CRM, confirmation and unsubscribe flow |
| AV News                     | Three placeholder articles and a placeholder publication page                                                                           | News page states that publishing is not connected          | Editorial workflow and approved content source; static rebuild webhook or content API                 |
| Testimonials                | Unsourced names/quotes and concept-only impact stories                                                                                  | Unsourced testimonial sections are absent                  | Customer-approved content records with release/consent metadata and asset ownership                   |
| Impact counters             | Unsourced percentages, totals, and dashboard-style counts                                                                               | Unverified counter groups are absent                       | Approved annual report or reporting pipeline with source, period, approver, and review date           |
| AV Active downloads         | Nonfunctional App Store/Google Play buttons and outdated launch/beta dates                                                              | Explicitly says the application service is not connected   | Separate product release process, real store URLs, Cognito/app API if the product launches            |
| Resource tools              | Resume translator and job-board links that intentionally did nothing                                                                    | Nonfunctional controls are absent                          | Separate approved product/API scope; not part of the initial website backend                          |
| Board placeholder           | Initials-only portrait and generic biography                                                                                            | Placeholder profile is absent                              | Approved board content record and licensed portrait                                                   |

## Static content that remains

The following are not mock application data and remain in staging:

- Public crisis links, phone numbers, organization contact information, donation-provider links,
  social links, and GoHighLevel forms that navigate to an actual external service.
- Marketing copy, program descriptions, sponsor logos, and board profiles supplied in the customer
  concept. These still require normal customer content approval before production.
- The veteran-resource directory and its search/filter code. It is a curated public directory, not a
  fake database. Production should move ownership to an approved content workflow, record a source
  and review date for each entry, and automatically flag stale entries.
- `mailto:` contact forms. They open the visitor's email application and do not claim that a backend
  stored the message. Production should replace them with the contact workflow in the production
  plan if reliable delivery and case tracking are required.

## Data publication rule

No staging component may show a success state unless an external system returns a durable record ID.
No count, date, testimonial, person, event, availability status, or application record may be added
without an identified source and owner. Demo fixtures belong only in automated-test files and must
use obviously synthetic values; they may never be copied into a production bundle.

The site validator rejects the known prototype markers and fails the build if they return.
