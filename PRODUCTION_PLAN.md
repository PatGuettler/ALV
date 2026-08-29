# Alabama Veteran production plan

## Decision

Use **GitHub Pages for public staging** and **AWS for production**.

GitHub Pages is an excellent fit for customer review of the current static site: deployment is simple, the content is delivered through a CDN, and there is no server to maintain. It is not the right production boundary once the site owns user accounts, private form data, administrative tools, or database-backed content.

The production end state should keep the public website static at the edge and put only genuinely dynamic operations behind authenticated APIs. That gives the high-traffic public pages the lowest cost and largest scaling margin while keeping personal data out of the browser bundle and static hosting layer.

## Target architecture

| Concern                    | Production service                                                                 | Why                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| DNS and TLS                | Route 53 + ACM                                                                     | Managed domain records and automatic certificate renewal                           |
| Public web assets          | Private S3 bucket behind CloudFront                                                | Durable origin, global caching, no public bucket access                            |
| Edge protection            | AWS WAF on CloudFront/API Gateway                                                  | Rate limiting, managed bot/common exploit rules, IP controls                       |
| Web application            | Static pages built with Vite; migrate content pages to Astro as they are separated | Fast HTML, minimal client JavaScript, real URLs, strong SEO                        |
| User identity              | Amazon Cognito User Pool                                                           | Sign-up/sign-in, MFA, password reset, social/OIDC options, JWTs                    |
| API                        | API Gateway HTTP API + Lambda                                                      | Autoscaling request layer with no idle server fleet                                |
| Relational data            | Aurora Serverless v2 PostgreSQL + RDS Proxy                                        | Appropriate for users, applications, event registration, roles, and reporting      |
| Simple high-volume lookups | DynamoDB where access patterns are key/value oriented                              | Predictable scale for resource/event feeds when relational queries are unnecessary |
| Files and uploads          | Dedicated private S3 bucket with presigned uploads                                 | Keeps large files out of the API and controls access                               |
| Secrets                    | Secrets Manager / SSM Parameter Store                                              | No credentials in GitHub, JavaScript, or repository files                          |
| Transactional email        | SES                                                                                | Managed email delivery, suppression, and bounce handling                           |
| Observability              | CloudWatch logs/metrics/alarms, CloudTrail, AWS Budgets                            | Operational visibility, audit history, and cost alerts                             |
| CI/CD                      | GitHub Actions using AWS OIDC roles                                                | Short-lived credentials; separate staging and production environments              |

Aurora and DynamoDB should not both be introduced automatically. Start with Aurora PostgreSQL if the first dynamic features involve related user/application/event records. Add DynamoDB only for a workload whose measured access pattern benefits from it.

## Application boundaries

The browser may contain public content and call public or authenticated APIs. It must never contain database credentials, AWS access keys, GHL private keys, or administrator tokens.

Suggested initial data domains:

1. **Public content:** news, events, veteran resources, board profiles, sponsors. Render these into static pages during deployment and cache them at CloudFront.
2. **Identity and roles:** Cognito identities with application roles such as visitor, member, editor, and administrator. Enforce authorization again in every API operation.
3. **Private submissions:** retreat applications, contact requests, volunteer inquiries, and file uploads. Encrypt at rest, retain only what is necessary, log access, and define deletion/retention rules before launch.
4. **Commerce and donations:** continue redirecting to a PCI-compliant hosted provider. Do not collect card data in this application.

The current GoHighLevel embeds and email-client form behavior are staging integrations, not a final private-data architecture. Before accepting real submissions, document whether GHL or AWS is the system of record and execute the appropriate privacy/security review.

Warrior Retreat staff review is in the same category. The standalone application artifact currently uses a shared client-side passcode and hardcoded sample applicant records. That is a prototype of an admin UI, not a production intake or staff workspace. Do not treat it as live, and do not put real credentials or applicant PII into the static site. See **Warrior Retreat applications and staff access** below.

## Delivery phases

### Phase 0 — public visual staging (implemented in this repository)

- Deploy the approved concept to GitHub Pages.
- Preserve the customer baseline while extracting embedded images into cacheable build assets.
- Run source and build checks on every deployment.
- Keep staging free of secrets, private submissions, and test user data.
- Do not present the prototype **Staff Login** on `warrior-retreat-application.html` as a working staff tool. It is a client-side demo against sample records.

Exit criterion: the customer approves desktop and mobile visual fidelity and signs off on the page/content inventory.

### Phase 1 — production-ready public site

- Split the current JavaScript-switched sections into real routes such as `/about/`, `/events/`, and `/resources/`.
- Move shared navigation, footer, buttons, forms, and cards into components.
- Move resources/events/news into validated content files or a headless editorial source.
- Add page-specific titles, descriptions, canonical URLs, Open Graph images, sitemap, robots rules, and structured data.
- Self-host optimized fonts/images where licensing allows; generate responsive image variants and dimensions.
- Meet WCAG 2.2 AA: keyboard navigation, visible focus, landmarks, labels, contrast, reduced-motion behavior, and screen-reader testing.
- Add consent-aware analytics only after the customer chooses a provider and privacy policy.

Recommended framework for this phase: **Astro with small vanilla/TypeScript islands** for the calendar, resource search, menu, and modals. The current Vite staging shell is intentionally low-risk; Astro can reuse the same browser-side modules as routes are separated.

Exit criterion: Lighthouse/accessibility budgets pass, every route is shareable, redirects are mapped, and customer content is final.

### Phase 2 — AWS production foundation

- Create separate AWS accounts or at minimum separate stacks for non-production and production.
- Define infrastructure as code (AWS CDK or Terraform), including S3, CloudFront, ACM, Route 53, WAF, logging, and alarms.
- Deploy with GitHub Actions and AWS OIDC; require GitHub environment approval for production.
- Apply cache policy: hashed assets `public, max-age=31536000, immutable`; HTML short-lived with revalidation.
- Configure CloudFront security headers and a Content Security Policy without broad `unsafe-inline` allowances after scripts/styles are modularized.
- Add uptime checks, error alarms, cost budgets, backup policies, and a rollback/runbook.

Exit criterion: repeatable deployments, tested rollback, production domain/TLS, WAF rules, monitoring, and recovery procedures.

### Phase 3 — authenticated and database-backed features

- Define exact user journeys and data classification before selecting tables or API operations.
- Add Cognito, API Gateway, Lambda, and Aurora PostgreSQL/RDS Proxy through infrastructure as code.
- Use least-privilege IAM, JWT validation, server-side authorization, input validation, rate limits, CSRF-safe patterns, and audit events.
- Add CAPTCHA/bot controls to anonymous forms and malware scanning for uploads.
- Test backup restoration, account recovery, data export/deletion, and incident response.
- Load-test APIs with representative read/write ratios; scale from evidence rather than traffic guesses.

Exit criterion: security review completed, privacy/retention policy approved, load targets met, and operational ownership assigned.

## Warrior Retreat applications and staff access

Customer feedback from Chris Montz (August 2026):

- After **Apply for a Retreat**, staff expect a **Staff Login** control at the bottom of the screen. Chris does not see a working login on the Warrior Retreat marketing page and reports that the control on the application does not work for him.
- Once signed in, staff need to review the information that flows through the application.
- The current shared passcode is not an acceptable security model. Chris is not sure how to store applications in a database, and wants the team to keep using **GoHighLevel** because it is already easy for staff.

### Where the login actually is today

The public Warrior Retreat page (`/warrior-retreat/`) has no staff login. **Apply for a Retreat** opens the standalone file `warrior-retreat-application.html`. That file’s footer contains a **Staff Login** button. Chris’s working Claude artifact uses `window.prompt()` (`openAdmin()`).

That placement is easy to miss if someone stays on the marketing page. Do not document or copy the shared passcode into this plan, extra files, or email threads.

### Transfer finding (August 29, 2026)

Chris confirmed the Claude-built tool works for him and sent `WarriorRetreat_ApplicationSystem.7z` after the transferred site rejected staff login. Comparing that archive to the copy then in this repository:

- Form fields, admin views, sample records, and GHL/grant CSV export were the same product.
- During transfer the HTML was minified, `prompt()` was replaced with a custom overlay (`submitStaffLogin` / `staff-login-overlay`), and the client-side passcode string was changed to a different value than the one staff use.
- Staff typing the known passcode therefore always failed. Nothing in the archive linked to an external site or database; it is the same in-browser prototype.

The customer-sent HTML is restored as `warrior-retreat-application.html` so staging matches the Claude tool. This is still not production security. The archive itself is gitignored and must not be committed.

### What the current artifact actually does

This is a front-end prototype, not a staff system:

- Access is a JavaScript string comparison. Anyone can read the passcode from the page source. There are no individual accounts, MFA, lockout, audit logs, or server-side authorization.
- The admin view is filled with **hardcoded sample applicant records** (names, emails, phones, service and health-related fields) shipped in the HTML. Form submissions are not saved. There is no database.
- **Export to GoHighLevel** downloads a CSV of selected fields. It does not write into GHL. A marketing-oriented GHL field list exists in the same file; it is not a live webhook.
- GitHub Pages is a public host. A real staff inbox, real applications, and any shared password must not live there.

### Recommended production shape

Keep the public Apply experience on the static site. Put identity, storage, and staff review behind a system that is not the public HTML bundle.

Pick a **system of record**. A hybrid is allowed only if ownership of each field is written down.

**Option A — GoHighLevel owns review (fits current staff workflow)**

Use this if staff should keep working in GHL and GHL’s permissions are acceptable for the data involved.

- The public form posts into a GHL form, survey, or inbound webhook.
- Staff log into **GoHighLevel**, not the public website. Remove **Staff Login** from the static application.
- Tags cover retreat type, session, past attendee, and application status. Grant reporting uses GHL export or a scheduled extract, not a public admin page.
- Confirm whether health, service-connected, and similar answers may live in GHL, who can see them, and how long they are retained.

**Option B — AWS owns the full application (required if GHL cannot hold this data)**

Use this if the application is private case data rather than a CRM contact.

- Anonymous public POST to API Gateway + Lambda; store in Aurora PostgreSQL with encryption at rest.
- Staff authenticate with Cognito (individual users, MFA, password reset). Every read/update is authorized on the server. No shared passcode.
- Optional: after intake, push a **marketing-safe subset** (name, email, phone, retreat tags) into GHL so fundraising still happens in the tool staff already use. Health and grant fields stay in AWS.

Do not run two live staff inboxes. If both products exist, GHL is the CRM; AWS (or GHL) is the application file of record.

### Near-term staging rules

- Do not advertise the prototype staff login as a working tool.
- Strip or disable sample applicant PII before any public URL is treated as customer-facing staging of real applications.
- Do not add a real password, API key, or GHL private webhook secret to the static site.
- If a demo of the admin UI is needed, use a private preview, not GitHub Pages.

### Customer decisions still required

- Is GHL the system of record for retreat applications, or only the CRM that receives a contact subset?
- Which staff roles need the full application versus marketing fields only?
- Should the public site have **no** staff login (recommended if GHL owns review)?
- Retention, who deletes records, and whether health/wellbeing answers may live in GHL.

## Performance and traffic targets

Use budgets as acceptance criteria, not aspirations:

- p75 Largest Contentful Paint under 2.5 seconds on mobile field data.
- p75 Interaction to Next Paint under 200 ms; cumulative layout shift under 0.1.
- Initial route HTML plus critical compressed resources kept deliberately small; defer noncritical widgets.
- At least 99% of public asset requests should be served from CloudFront during normal operation.
- Define expected and peak authenticated API requests per second before load testing; test at least 2x the agreed peak.
- No direct browser-to-database connectivity and no unbounded database connection creation from Lambda.

## Decisions required from the customer

Before Phase 1 begins, obtain written answers for:

- Which delivered file/page list is authoritative. The handoff names `avactivefinal_compressed.html`, but other repository artifacts include Store and an integrated application page that are absent from that named master.
- Whether Store is in launch scope and which hosted commerce provider owns checkout.
- Whether retreat applications and contact/volunteer submissions belong in GoHighLevel or the new AWS system. Chris’s preference is that staff keep using GHL; confirm whether GHL may hold the full application or only a marketing contact subset. See **Warrior Retreat applications and staff access**.
- Whether the public site should expose any staff login at all, or staff should authenticate only in GHL / Cognito.
- Whether public visitors create accounts, or accounts are only for members/staff.
- Who can publish news/events/resources and whether approvals are required.
- Data retention, privacy policy, accessibility owner, analytics provider, and incident contact.
- Required launch date, traffic assumptions, availability target, and monthly AWS budget.

## GitHub Pages staging operations

The Pages site is public. Protect `main`, require the build workflow, and use pull requests for review. GitHub repository settings must have **Pages → Source: GitHub Actions** enabled. Every push to `main` then builds and deploys the site; manual deployment is also available from the Actions tab.

When a custom staging domain is added, configure it in GitHub Pages, add the documented DNS record, enable HTTPS, and add a `CNAME` file to the generated public assets. Do not point the production apex domain to GitHub Pages if AWS is the selected production platform.
