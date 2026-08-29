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
| User identity              | Amazon Cognito User Pool                                                           | Invite-only staff/admin, MFA, password reset, JWTs to API Gateway                  |
| API                        | API Gateway HTTP API + Lambda                                                      | Autoscaling request layer with no idle server fleet                                |
| Relational data            | Aurora Serverless v2 PostgreSQL + RDS Proxy                                        | Appropriate for users, applications, event registration, roles, and reporting      |
| Simple high-volume lookups | DynamoDB where access patterns are key/value oriented                              | Predictable scale for resource/event feeds when relational queries are unnecessary |
| Files and uploads          | Dedicated private S3 bucket with presigned uploads                                 | Keeps large files out of the API and controls access                               |
| Secrets                    | Secrets Manager / SSM Parameter Store                                              | No credentials in GitHub, JavaScript, or repository files                          |
| Transactional email        | SES                                                                                | Managed email delivery, suppression, and bounce handling                           |
| Observability              | CloudWatch logs/metrics/alarms, CloudTrail, AWS Budgets                            | Operational visibility, audit history, and cost alerts                             |
| Infrastructure as code     | Terraform                                                                          | Repeatable AWS resources, remote state, plan-on-PR and apply-on-merge              |
| CI/CD                      | GitHub Actions using AWS OIDC roles                                                | Short-lived credentials; `terraform apply` on every merge to `main`                |

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

### Phase 2 — AWS foundation (Terraform)

- Create separate AWS accounts or, at minimum, separate Terraform roots/workspaces for non-production and production.
- Check in Terraform under `infra/` as specified in **Terraform layout** below. Do not click-ops login, API, or database resources.
- Create the S3 + DynamoDB remote state backend once (bootstrapped out of band), then all later changes go through Git.
- Wire GitHub Actions OIDC to an IAM role. **Every merge to `main` runs `terraform apply`.** Pull requests run `terraform plan` only.
- Apply cache policy: hashed assets `public, max-age=31536000, immutable`; HTML short-lived with revalidation.
- Configure CloudFront security headers and a Content Security Policy without broad `unsafe-inline` allowances after scripts/styles are modularized.
- Add uptime checks, error alarms, cost budgets, backup policies, and a rollback/runbook.

Exit criterion: `terraform plan` is a required PR check, merge to `main` applies cleanly, rollback is documented, and production domain/TLS/WAF/monitoring exist.

### Phase 3 — authenticated and database-backed features

- Replace the prototype Staff Login with the **login infrastructure** below (Cognito, no shared passcode in HTML).
- Add API Gateway, Lambda, and Aurora PostgreSQL/RDS Proxy through the same Terraform root.
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

## Login infrastructure

The prototype `prompt()` plus a shared passcode is staging-only. Production staff login is AWS-hosted identity. Applicants do not create accounts.

### Actors

| Actor            | Authentication                         | What they can do                                                                |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Public applicant | None                                   | Submit a retreat application; receive a confirmation                            |
| Staff            | Cognito user, MFA required             | List, filter, open, and update applications assigned to their role              |
| Admin            | Cognito user in the `admin` group, MFA | Manage sessions, export grant/GHL files, invite or disable staff, change status |

No self-sign-up. Staff are invited by an admin (Cognito admin create user + temporary password + forced reset). Password reset and MFA enrollment use Cognito, not custom email/SMS code in the static site.

### Request path

1. Public **Apply** stays a static page. Submit `POST`s to API Gateway (unauthenticated route) with bot controls. Lambda validates and writes to Aurora. Optional: enqueue a marketing-safe contact subset for GHL.
2. **Staff Login** on the application page redirects to **Cognito Hosted UI** (or a small first-party login page that uses the Cognito SDK). It must not compare a passcode in JavaScript.
3. After sign-in, Cognito returns tokens to a staff-only origin (or a dedicated `/staff/` route). The browser stores tokens per Cognito SPA guidance (memory + refresh via the SDK; not `localStorage` for the ID token if a tighter model is chosen).
4. Staff API calls send the access token. API Gateway JWT authorizer validates the token against the user-pool issuer and audience. Lambda checks the Cognito group (`staff` or `admin`) before any read or write.
5. Application PII never ships in the static bundle. Sample records stay out of production builds.

### AWS resources (login and first API)

Terraform must create at least:

- **Cognito user pool** — invite-only, strong password policy, MFA required (TOTP), account recovery email, unused-account and failed-login protections.
- **Groups** — `staff`, `admin`. Authorization is group-based and re-checked in Lambda, not only in the UI.
- **App client** — public SPA client, no client secret, authorization-code + PKCE, callback/logout URLs limited to the staff origin.
- **Cognito domain / Hosted UI** — branded enough for staff; no public marketing chrome required.
- **API Gateway HTTP API** — routes such as `POST /applications` (public, WAF + rate limit + CAPTCHA), `GET/PATCH /applications` and `GET /applications/{id}` (JWT), `POST /exports/ghl` and `POST /exports/grant` (`admin` only).
- **JWT authorizer** on staff routes, bound to the user-pool issuer.
- **Lambda** (Node or Python) in a VPC only if it must reach Aurora via RDS Proxy; otherwise keep public-submit functions outside the VPC.
- **Aurora Serverless v2 PostgreSQL + RDS Proxy** — applications, sessions, staff audit events. Encrypt at rest. No public DB endpoint.
- **Secrets Manager** — DB credentials, GHL webhook token if used. Injected into Lambda via IAM, never into the browser.
- **CloudWatch** — auth failures, 4xx/5xx, Lambda errors, WAF blocks. Alarm on repeated failed staff logins.
- **WAF** on the API (and later CloudFront) — rate limit anonymous submit; AWS managed common-rule and known-bad-input groups.

SES can send Cognito messages once the domain is verified. Until then, Cognito’s default email is acceptable only in non-production.

### What the static site is allowed to contain

Build-time public values only, injected from Terraform outputs: Cognito user-pool ID, app-client ID, Hosted UI domain, API base URL, and region. No pool secrets, IAM keys, GHL private keys, or database URLs.

## Terraform layout

All AWS login and data-plane resources are defined in Terraform. Click-ops is not an allowed change path after the state backend exists.

```text
infra/
├── backend.tf          # S3 state + DynamoDB lock
├── versions.tf         # pinned Terraform and AWS provider
├── providers.tf        # default tags, assume-role / OIDC-friendly
├── variables.tf
├── outputs.tf          # values the site build and staff app consume
├── main.tf             # module wiring only
└── modules/
    ├── identity/       # Cognito pool, groups, app client, domain, SES mail
    ├── api/            # HTTP API, JWT authorizer, WAF association, routes
    ├── compute/        # Lambda functions and IAM roles
    ├── data/           # Aurora, RDS Proxy, Secrets Manager, upload bucket
    └── observability/  # log groups, alarms, dashboard
```

Rules:

- Pin Terraform `>= 1.9` and the AWS provider with a lock file (`infra/.terraform.lock.hcl`) committed.
- One remote state per environment (`staging`, `production`) in a dedicated state bucket. State encryption and bucket versioning on. DynamoDB lock table required.
- Environments are separate state keys (or separate AWS accounts), not `terraform destroy`/`workspace` improvisation on a laptop.
- Default tags on every resource: `Project=alabama-veteran`, `Env`, `ManagedBy=terraform`.
- Outputs include `cognito_user_pool_id`, `cognito_app_client_id`, `cognito_domain`, `api_base_url`, and `region`. The site workflow reads these after apply.
- Modules have no hardcoded account IDs or passcodes. Staff users are invited through Cognito after apply, not declared as passwords in `.tfvars`.
- `terraform fmt -check` and `terraform validate` are required. `tflint` is recommended once the root exists.

Bootstrap (once, documented in `infra/README.md` when added): create the state bucket, lock table, OIDC provider, and GitHub IAM role. Those bootstrap resources may live in a small `infra/bootstrap/` root applied manually by an account owner. Everything else applies from CI.

## CI/CD: plan on pull request, apply on merge to `main`

GitHub Pages staging remains `.github/workflows/pages.yml`. Infrastructure is a second workflow, `.github/workflows/terraform.yml`.

### Pull request (required check)

On `pull_request` targeting `main`:

1. `terraform fmt -check`
2. `terraform init -input=false`
3. `terraform validate`
4. `terraform plan -input=false -out=tfplan`
5. Upload the plan and a human-readable plan comment (or artifact) on the PR

No apply on pull requests. Fork PRs must not receive AWS credentials.

### Merge to `main` (apply)

On every push to `main` (including PR merge):

1. Check out the merged commit.
2. Authenticate to AWS with **GitHub OIDC** (`permissions: id-token: write`). No long-lived access keys in GitHub secrets.
3. `terraform init -input=false`
4. `terraform plan -input=false -out=tfplan` against the environment `main` deploys
5. `terraform apply -input=false tfplan`

Apply uses the plan file from the same job so the applied set matches what was just planned. Do not `apply -auto-approve` without a plan file.

`terraform apply` is idempotent. Running it on every merge to `main` is intentional: a docs-only merge is a no-op apply; an infra merge converges AWS to the new desired state; drift from click-ops is detected on the next plan.

### Environments and blast radius

| GitHub Environment | When it applies                          | Protection                                                     |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| `aws-staging`      | Every merge to `main`                    | OIDC role limited to the staging account/stack                 |
| `aws-production`   | Merge to `main` after required reviewers | Separate OIDC role; required reviewers; wait timer recommended |

Until production AWS is ready, **merge to `main` applies staging only**. Production apply is the same workflow job gated by the `aws-production` environment. Do not point `main` at production apply until reviewers and a rollback runbook exist.

Concurrency: one apply at a time (`concurrency: terraform-${environment}`). Do not cancel an in-progress apply.

### Order relative to the Pages deploy

When the static site starts consuming Cognito/API outputs:

1. Terraform apply on `main` (staging)
2. Read outputs
3. `npm run build` with those values (`VITE_` / `BASE_PATH` / Cognito IDs)
4. Existing Pages deploy job

Until that wiring exists, Pages and Terraform jobs may run in parallel on `main`. Pages must still refuse to ship secrets.

### Rollback

- Terraform state versioning on the backend bucket is the first undo path (`terraform apply` of the previous commit).
- Database migrations are versioned separately and are never implied by a `terraform destroy`.
- Destroying the user pool is a customer-approved emergency only; staff would have to be re-invited.

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
- AWS account IDs for staging and production, who holds the bootstrap credentials, and who may approve `aws-production` applies.

## GitHub Pages staging operations

The Pages site is public. Protect `main`, require the build workflow **and** the Terraform plan check, and use pull requests for review. GitHub repository settings must have **Pages → Source: GitHub Actions** enabled. Every push to `main` then builds and deploys the site; manual deployment is also available from the Actions tab.

The same merge to `main` also runs `terraform apply` for the AWS environment attached to `main` (staging first). See **CI/CD: plan on pull request, apply on merge to `main`**.

When a custom staging domain is added, configure it in GitHub Pages, add the documented DNS record, enable HTTPS, and add a `CNAME` file to the generated public assets. Do not point the production apex domain to GitHub Pages if AWS is the selected production platform.
