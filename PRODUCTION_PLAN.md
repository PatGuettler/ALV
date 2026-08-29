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

## Delivery phases

### Phase 0 — public visual staging (implemented in this repository)

- Deploy the approved concept to GitHub Pages.
- Preserve the customer baseline while extracting embedded images into cacheable build assets.
- Run source and build checks on every deployment.
- Keep staging free of secrets, private submissions, and test user data.

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
- Whether retreat applications and contact/volunteer submissions belong in GoHighLevel or the new AWS system.
- Whether public visitors create accounts, or accounts are only for members/staff.
- Who can publish news/events/resources and whether approvals are required.
- Data retention, privacy policy, accessibility owner, analytics provider, and incident contact.
- Required launch date, traffic assumptions, availability target, and monthly AWS budget.

## GitHub Pages staging operations

The Pages site is public. Protect `main`, require the build workflow, and use pull requests for review. GitHub repository settings must have **Pages → Source: GitHub Actions** enabled. Every push to `main` then builds and deploys the site; manual deployment is also available from the Actions tab.

When a custom staging domain is added, configure it in GitHub Pages, add the documented DNS record, enable HTTPS, and add a `CNAME` file to the generated public assets. Do not point the production apex domain to GitHub Pages if AWS is the selected production platform.
