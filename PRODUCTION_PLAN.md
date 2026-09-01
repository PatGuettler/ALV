# Alabama Veteran production plan

## Current AWS status (2026-08-31) — pick up here

This section is the operator/AI handoff for work already applied. Do not create a second AWS
Organization or a second payer. Do not import Halo clickops into Terraform. Do not treat IAM Identity
Center as Alabama Veteran staff login (that is Cognito later, issue 38 / 154).

### Decisions that are locked

- Company payer is the **existing KeyTrain** AWS account. Halo clickops already lives there; that is
  expected. ALV is a **member-account tenant**, not a new bill.
- Product code is **ALV**, not AVL. Resource prefix for ALV workloads is `alv-<environment>`.
- KeyTrain engineers use **IAM Identity Center**. Alabama Veteran staff (Chris) do **not**.
- First org apply created **ALV nonprod and prod only**. Halo, learning, pest-control, log-archive,
  audit, and shared-services **accounts** are not created yet. Empty OUs for those products exist.
- **Build Warrior Retreat and the AWS site in ALV prod (`286801153738`) first.** The customer-facing
  site is still GitHub Pages only; AWS prod is the integration environment until DNS cutover.
  Start using ALV nonprod as an AWS staging env only after prod is in a good state. Do not require
  nonprod-first for retreat/Cognito/API work.

### Live identifiers

| Thing                           | Value                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| KeyTrain payer / org management | `607292335442` (console name KeyTrain)                                                                  |
| Organization                    | `o-g8wnpu966s` (already existed; **imported** into Terraform, not created)                              |
| Organization root               | `r-508d`                                                                                                |
| IAM Identity Center instance    | `ssoins-72231312dc803ed4` (organization instance, primary Region `us-east-1`)                           |
| Identity store                  | `d-90667ccc2c`                                                                                          |
| Access portal (IPv4)            | `https://d-90667ccc2c.awsapps.com/start`                                                                |
| Identity source                 | Identity Center directory                                                                               |
| Org Terraform state bucket      | `keytrain-org-tfstate` in `us-east-1` (private, versioned, SSE-S3, ACLs disabled)                       |
| State key                       | `organization/us-east-1/terraform.tfstate`                                                              |
| ALV nonprod account             | `177258422136` (`keytrain-alv-nonprod`, tags Product=alv Environment=nonprod)                           |
| ALV prod account                | `286801153738` (`keytrain-alv-prod`, tags Product=alv Environment=prod)                                 |
| ALV OU                          | `websites` (`ou-508d-2dtrfvo4`)                                                                         |
| Identity Center group           | `alv-operators`                                                                                         |
| Permission set                  | `ALVAdministrator` (AdministratorAccess, 4h, assigned **only** to the two ALV accounts)                 |
| Operator user                   | `patguettler@gmail.com` (Identity Center user **Pat Guettler**)                                         |
| New account root emails         | `patguettler+alv-nonprod@gmail.com` and `patguettler+alv-prod@gmail.com` (same Gmail inbox)             |
| Org monthly budget              | `keytrain-org-monthly` $100, mail `patguettler@gmail.com`                                               |
| Local CLI profile `alv`         | IAM user **PatG** in the **payer** (`607292335442`), not an ALV account. Use for `infra/live/org` only. |

Cost Explorer: charge Alabama Veteran by **linked account** `177258422136` / `286801153738`. Activate
cost allocation tags `Product`, `Environment`, and `Company` after those accounts have spend (AWS
rejected activation on 2026-08-31 because the keys were not in billing data yet).

### Terraform that is live

Root: `infra/live/org/us-east-1`. Applied 2026-08-31: 15 added, 1 changed, 0 destroyed. The existing
organization was updated in place (service access principals + SCP policy type enabled). Clickops in
the payer was not imported.

Gitignored local files (do not commit):

- `infra/live/org/us-east-1/terraform.tfvars`
- `infra/live/org/us-east-1/org.s3.tfbackend`

```bash
export AWS_PROFILE=alv
export AWS_DEFAULT_REGION=us-east-1
terraform -chdir=infra/live/org/us-east-1 init -backend-config=infra/live/org/us-east-1/org.s3.tfbackend
terraform -chdir=infra/live/org/us-east-1 plan
```

Do not `destroy` this root. Do not remove ALV accounts from `var.accounts`.

`infra/live/prod` Warrior Retreat intake is applied in ALV prod `286801153738`. `infra/live/nonprod`
is still unwired. Do not apply ALV website roots to the KeyTrain payer `607292335442`.

### Warrior Retreat (applied 2026-08-31)

Invite-only Cognito staff login, DynamoDB applications table, HTTP API, and Lambda are live in ALV
prod. GitHub Pages remains the public site; after this code is on `main`, apply at
`/warrior-retreat-application/` and staff sign-in at `/warrior-retreat-staff/`. Locally:
`http://127.0.0.1:4321/warrior-retreat-staff/`.

This is **not** the Identity Center portal. Check email (including spam) for the Cognito invite to
`patguettler@gmail.com`, then set a password on the hosted UI. Do not paste one-time passwords into
chat.

| Thing                | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| API                  | `https://p364msgsc2.execute-api.us-east-1.amazonaws.com`                 |
| Cognito hosted UI    | `https://alv-prod-retreat-286801153738.auth.us-east-1.amazoncognito.com` |
| SPA client ID        | `37tsmb3p4du202e1vmstblsrui` (public)                                    |
| User pool            | `us-east-1_6t3Xrh6Oc`                                                    |
| Prod Terraform state | `keytrain-org-tfstate` key `alv/prod/us-east-1/terraform.tfstate`        |

```bash
export AWS_PROFILE=alv
export AWS_DEFAULT_REGION=us-east-1
terraform -chdir=infra/live/prod/us-east-1 init -backend-config=infra/live/prod/us-east-1/prod.s3.tfbackend
terraform -chdir=infra/live/prod/us-east-1 plan
```

### How humans log in

1. KeyTrain house (Halo clickops): IAM user `PatG` in account `607292335442` (existing console URL).
2. ALV rooms: Identity Center portal → tiles `keytrain-alv-nonprod` / `keytrain-alv-prod` → role
   `ALVAdministrator`. Confirmed working for prod (`286801153738`) on 2026-08-31.
3. MFA: Identity Center Settings → Authentication → if no MFA device, **require registration at
   sign-in**. First login used an admin one-time password; forgot-password failed until that MFA
   policy was set. Do not paste one-time passwords into chat.
4. Workload Region for ALV resources: `us-east-1` (the Identity Center portal may open `us-east-2`).
5. Warrior Retreat staff: Cognito hosted UI from `/warrior-retreat-staff/` with the invited email.
   Not the AWS access portal.

### Explicitly not done

- Log-archive, audit, shared-services, Halo, keytrainlearning, pest-control **accounts**
- GitHub OIDC plan/apply roles; org Terraform still uses long-lived PatG access keys locally
- State bucket access logging and deny-unauth policies beyond default owner
- Organization CloudTrail/Config/GuardDuty/Security Hub **as working delegated services** (principals
  were enabled on the org; trails/hubs were not built)
- SCPs, AWS Backup, Control Tower
- ALV static site on S3/CloudFront (GitHub Pages is still the public origin)
- Issue 37 privacy/retention review before treating submissions as production veteran records
- Cost allocation tags in Billing

### Next engineering slice

Warrior Retreat intake is live in ALV prod. GitHub Pages still needs this branch on `main` before
the public apply/staff URLs work on github.io. Local `npm run dev` can sign in now.

1. Merge/deploy so Pages serves the live form and staff login.
2. Issue 248: private S3 web origin in ALV **prod**.
3. Issue 37 before treating public submissions as production veteran records.
4. Later: wire `infra/live/nonprod` to `177258422136` as AWS staging. Issue 79 / 26 remainder: GitHub
   OIDC.

## End goal and hosting decision

Use **GitHub Pages only for public visual staging**. Use **AWS for production**.

The production site should be the static Astro build in a private S3 bucket behind CloudFront.
Dynamic behavior should be small, independently scalable APIs rather than a permanent web server.
This design keeps ordinary page traffic at the edge and puts identity, submissions, calendars, and
private records behind authenticated services.

The initial AWS backend should be serverless: API Gateway, Lambda, DynamoDB, SQS, SES, Cognito, and
S3. It needs no EC2 instances, Auto Scaling Groups, containers, or AMIs. Aurora PostgreSQL should be
added only if reporting and transaction requirements become relational enough to justify it.

The removed prototype inventory and its production replacement are in
[MOCK_DATA_AUDIT.md](MOCK_DATA_AUDIT.md).

## Environments and AWS accounts

The AWS Organization belongs to **keyTrain**, not to a single customer site. The existing keyTrain
AWS account is the payer. Alabama Veteran (ALV) is a member-account tenant under the websites OU,
next to Halo, keytrainlearning, and other hosted sites. Clickops already in the payer stays
unmanaged; ALV website Terraform never runs in that account.

| Account                                         | Purpose                                                                | Must not contain                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| keyTrain management/payer                       | Organization, consolidated billing, Identity Center, existing clickops | ALV/Halo application data, CI deploy into clickops |
| Log archive                                     | Immutable organization CloudTrail/Config and service-log archive       | Developers or application data                     |
| Security/audit                                  | Delegated Security Hub, GuardDuty, IAM Access Analyzer                 | Production write access                            |
| Shared services                                 | Product Terraform state (after org state), GitHub OIDC                 | End-user PII                                       |
| Halo / keytrainlearning nonprod and prod        | Those products' own infrastructure                                     | ALV or other-product data                          |
| Website product accounts (ALV, pest control, …) | That site's origin, APIs, and data                                     | Other products' workloads                          |

ALV non-production and production must remain separate from each other and from Halo and
keytrainlearning. Control Tower is optional later and must not be enabled in the clickops account.

Apply these organization guardrails:

- Root users have hardware MFA and no access keys; credentials are held as break-glass only.
- Human AWS access uses IAM Identity Center groups and temporary role credentials. Do not create IAM
  users for developers.
- Service control policies deny leaving the organization, disabling security/logging services,
  unapproved Regions, public S3 access, and changes to protected log buckets.
- Delegate GuardDuty, Security Hub, Config aggregation, and IAM Access Analyzer to security/audit.
- Enable organization CloudTrail and Config in all accounts; central copies go to log archive.
- Define `us-east-1` as the initial workload Region. CloudFront is global and its ACM viewer
  certificate must be in `us-east-1`.

AWS reference: [Control Tower shared accounts](https://docs.aws.amazon.com/controltower/latest/userguide/special-accounts.html)
and [IAM security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html).

## Target request paths

```text
Public visitor
  -> Route 53
  -> CloudFront + WAF
     -> private S3 origin (HTML, CSS, JS, images)
     -> /api/* origin -> API Gateway HTTP API -> Lambda
                                            -> DynamoDB
                                            -> SQS -> worker Lambda -> SES / approved CRM
                                            -> private S3 uploads

Staff browser
  -> Cognito managed login (authorization code + PKCE, MFA/passkey)
  -> staff application at CloudFront
  -> API Gateway JWT authorizer + scoped routes
  -> Lambda authorization + DynamoDB/S3
  -> append-only application audit records
```

The S3 website bucket is not public. CloudFront uses Origin Access Control (OAC), which AWS
recommends over the legacy OAI model. See
[Restrict access to an S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## Feature-to-infrastructure map

| Feature              | Public behavior                           | Production services and source of truth                                                 |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Marketing pages      | Static and globally cached                | Git content + Astro build, S3, CloudFront                                               |
| News                 | Only approved published posts             | Git-based editorial PRs initially; optional content table and staff editor later        |
| Resource directory   | Search approved public entries            | DynamoDB content table or validated content files; each record has source/review dates  |
| Events/calendar      | Public future events, iCalendar feed      | DynamoDB events table, API Gateway/Lambda, CloudFront API cache, staff editor           |
| Event signup         | Confirmed registration and capacity       | DynamoDB registrations table, conditional writes, SQS, SES confirmation                 |
| Newsletter           | Double opt-in and unsubscribe             | Subscription API, DynamoDB consent ledger, SES Contact List or approved CRM             |
| Contact/volunteer    | Durable request ID and routed case        | API Gateway, validation Lambda, SQS/DLQ, SES or approved CRM                            |
| Retreat applications | Secure intake and staff review            | Application API, field encryption, DynamoDB, private S3, Cognito staff portal           |
| Staff login          | Individual identity and audited access    | Cognito managed login, invite-only users, MFA/passkeys, scoped access tokens            |
| Public/member login  | Add only when a user-owned feature exists | Separate Cognito app client/groups and profile API; not required for anonymous signup   |
| Calendar reminders   | Scheduled, retryable delivery             | EventBridge Scheduler, SQS DLQ, Lambda, SES                                             |
| Donations/payments   | Redirect to hosted provider               | OneCause or another PCI-compliant provider; never collect card data here                |
| ID.me                | Optional real verification only           | Contracted vendor OAuth/OIDC callback handled server-side; no simulated browser control |

No feature may maintain two silent systems of record. If GoHighLevel owns a workflow, AWS stores only
delivery/audit metadata required to retry safely. If AWS owns it, GHL receives an explicitly approved
marketing-safe subset through an asynchronous integration.

## Identity and user management

There are three different identity populations; do not combine them:

1. AWS operators use IAM Identity Center permission sets in AWS Organizations.
2. Alabama Veteran staff use an Amazon Cognito user pool for the website staff application.
3. Public visitors are anonymous initially. Newsletter/event confirmation uses signed, expiring
   email links and does not force account creation.

Cognito configuration:

- Invite-only staff; public self-registration disabled on the staff app client.
- Groups/scopes: `content-editor`, `event-manager`, `application-reviewer`, `admin`, and
  `audit-readonly`.
- Managed Login with authorization-code flow and PKCE; public SPA client has no client secret.
- Require phishing-resistant passkeys where the selected Cognito feature plan supports them;
  otherwise require TOTP MFA. Do not use SMS as the only administrator factor.
- Exact callback/logout URLs per environment; no wildcard production callbacks.
- Short access-token lifetime, refresh-token rotation/revocation, protected recovery flow.
- API Gateway validates issuer, audience, expiry, and route scopes. Lambda repeats object-level and
  role checks; UI hiding is not authorization.
- Cognito stores identity attributes only. User/application business records live in DynamoDB.

AWS documents that managed login handles sign-in, MFA, password reset, and passkeys, and that API
Gateway HTTP API JWT authorizers validate token claims and scopes:
[Cognito managed login](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html),
[Cognito authentication flows](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html),
and [API Gateway JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html).

## DynamoDB data model

Use on-demand capacity initially. Separate tables make retention, backups, IAM, and breach impact
clearer than one large single-table design. Every table enables encryption, point-in-time recovery,
deletion protection in production, Contributor Insights where useful, and alarms for throttling and
system errors.

| Table                    | Keys/indexes                                                  | Stored records                                                       | Retention/notes                                                                      |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `av-content-{env}`       | `pk`, `sk`; sparse `publish-index` on status/date             | Events, news metadata, resource records and revisions                | Public fields only; source, owner, approval, reviewed-at required                    |
| `av-registrations-{env}` | `PK=EVENT#id`, `SK=REG#uuid`; GSI by email hash/time          | Event registrations, status, consent version                         | Conditional capacity counter; encrypt contact fields in application code             |
| `av-subscriptions-{env}` | `PK=EMAIL#sha256`; GSI by status/updated time                 | Consent timestamp, source, policy version, confirm/unsubscribe state | Email is envelope-encrypted; hash supports idempotency without plaintext key         |
| `av-applications-{env}`  | `PK=APP#uuid`, `SK=VERSION#n`; GSI by status/submitted time   | Retreat fields, workflow status, assignment                          | Sensitive fields envelope-encrypted; no health data until classification is approved |
| `av-idempotency-{env}`   | Request key + expiry TTL                                      | Safe retries for anonymous POST routes and queue workers             | Short TTL; never a business system of record                                         |
| `av-audit-{env}`         | `PK=SUBJECT#uuid`, `SK=timestamp#event-id`; GSI by actor/time | Staff reads, exports, status changes, access decisions               | Append-only API; retention set by approved policy, no sensitive field values         |

Important access patterns must be written before Terraform creates indexes: list published future
events, retrieve an event, register once, enforce capacity, list applications by status/time, load an
application history, find an operator's audit events, confirm/unsubscribe an email, and flag stale
resource records. Do not add a GSI without a named query and cost estimate.

Event capacity uses a DynamoDB transaction or conditional update so two concurrent signups cannot
take the last seat. API list routes use bounded page sizes and opaque pagination tokens. Public read
responses are cached at CloudFront; private/PII responses use `Cache-Control: no-store`.

Add Aurora Serverless v2 PostgreSQL and RDS Proxy only if approved reports require arbitrary joins,
transactional multi-record workflows become dominant, or DynamoDB access patterns no longer fit.
That later change adds a VPC, private subnets, security groups, Secrets Manager rotation, database
migrations, and materially higher operational cost.

## API contracts and workflows

Every mutation validates a JSON schema, enforces a small body limit, assigns a correlation ID,
redacts logs, applies idempotency, and returns a durable request/record ID. A browser animation is
never evidence of success.

Initial routes:

```text
GET    /v1/events?from=&to=&cursor=                  public, cached
GET    /v1/events/{id}                              public, cached
GET    /v1/calendar.ics                             public, cached briefly
POST   /v1/events/{id}/registrations                public + bot control
POST   /v1/subscriptions                            public + double opt-in
GET    /v1/subscriptions/confirm?token=              signed expiring token
POST   /v1/subscriptions/unsubscribe                 signed expiring token
POST   /v1/contact                                  public + bot control
POST   /v1/applications                             public + bot control
POST   /v1/uploads                                  public short-lived presigned policy if approved
GET    /v1/staff/applications                       JWT + application:read
GET    /v1/staff/applications/{id}                  JWT + object authorization
PATCH  /v1/staff/applications/{id}                  JWT + application:write + optimistic version
POST   /v1/staff/events                             JWT + event:write
PATCH  /v1/staff/events/{id}                        JWT + event:write
POST   /v1/staff/exports                            JWT + export scope + audit event
```

### Calendar and event signup

- Staff save a draft, then publish. Only `published` records with a future end time are public.
- The iCalendar endpoint is generated from the same event records; Google/Outlook subscription links
  point to that real feed.
- Registration writes are conditional on published status, deadline, duplicate email hash, and
  capacity. A transaction updates the event count and registration together.
- SQS decouples confirmation/reminder email. Workers are idempotent and use a DLQ.
- EventBridge Scheduler creates reminder jobs by registration/event ID, not a payload containing PII.
- Cancellation updates the record, invalidates cached event/ICS output, and queues notifications.

EventBridge Scheduler supports retry policies and SQS dead-letter queues; see
[Managing schedules](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule.html).

### Newsletter and contact signup

- Store the precise consent text version, source page, timestamp, and confirmation state.
- Send double-opt-in confirmation before marking a subscription active.
- SES uses verified domain identity, Easy DKIM, SPF, DMARC, configuration sets, bounce/complaint
  events, suppression handling, and one-click unsubscribe.
- A contact request enters SQS and gets a request ID before staff delivery. DLQ alarms prevent silent
  loss. Do not log message bodies.
- Choose SES Contact Lists or GoHighLevel as the marketing system of record before implementation.
  SES supports managed topic/list unsubscribe when `ListManagementOptions` is used; see
  [SES subscription management](https://docs.aws.amazon.com/ses/latest/dg/sending-email-subscription-management.html).

### Retreat intake and uploads

- Complete a privacy/data-classification review before collecting disability, mental-health,
  service, demographic, or household data. Collect only fields that have an approved purpose.
- Public submit Lambda envelope-encrypts sensitive field groups with KMS before writing DynamoDB.
- Attachments use short-lived presigned S3 POST policies with type/size restrictions, quarantine
  prefix, malware scan workflow, and promotion to a clean prefix. Staff cannot download unscanned
  files.
- Staff reads, exports, assignments, and status changes write audit records. Export files are
  encrypted, short-lived, access-logged, and automatically expired.
- ID.me must not be named or enabled until a vendor agreement, redirect URLs, claims contract, and
  server-side token handling are approved.
- Define retention and deletion before launch. DynamoDB TTL may trigger cleanup, but a scheduled
  reconciliation job must verify S3 attachments and secondary records are also removed.

## IAM design

All policies are generated by Terraform, scoped to environment-specific ARNs, and validated with IAM
Access Analyzer. No static AWS keys are stored in GitHub.

| Principal                   | Allowed                                                                  | Explicit boundary                                                                        |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| GitHub frontend deploy role | Upload built assets to one web bucket, CloudFront invalidation           | No DynamoDB, Cognito, KMS decrypt, or wildcard account access                            |
| GitHub Terraform plan role  | Read state/config and plan against nonprod                               | No apply, pass-role, secret values, or production trust                                  |
| GitHub Terraform apply role | Apply only the selected environment through protected GitHub Environment | Trust restricted to repository, branch/environment claims; permissions boundary required |
| Public API Lambda           | Schema/config read; write only its domain table/queue                    | No staff reads, exports, or broad scan                                                   |
| Staff API Lambda            | Scoped table/index/S3 actions for route function                         | Authorization enforced per record; no public-bucket writes                               |
| Queue worker Lambda         | Consume one queue, update its domain record, send approved SES template  | No API administration or unrelated table access                                          |
| Scheduler execution role    | Send only to named SQS queue/Lambda target                               | No generic `lambda:InvokeFunction` or `sqs:*`                                            |
| Cognito staff               | Invoke only API scopes carried in access token                           | Never receives AWS IAM credentials or direct DynamoDB/S3 permissions                     |
| Security auditor            | Read security findings/logs through Identity Center                      | No workload mutation or PII export                                                       |

Each Lambda gets its own role and log group. `iam:PassRole` is limited to exact service roles. KMS key
policies distinguish encrypt-only public intake from decrypting staff processors. Secrets Manager is
only for external service credentials such as approved CRM/ID.me secrets; DynamoDB and S3 use IAM
roles and need no stored access keys.

## Terraform design

### Repository layout

```text
infra/
├── bootstrap/
│   ├── state/                 # shared S3 backend + KMS + access logs
│   └── github-oidc/           # provider and tightly-scoped plan/apply roles
├── modules/
│   ├── static-site/           # S3, CloudFront OAC, ACM, Route 53, WAF, headers
│   ├── identity/              # Cognito pool, clients, groups, domain
│   ├── api/                   # API Gateway v2, routes, JWT authorizer, access logs
│   ├── function/              # Lambda, role, log group, alarms
│   ├── dynamodb-table/        # table, indexes, PITR, autoscaling/alarms
│   ├── messaging/             # SQS, DLQ, policies, age/depth alarms
│   ├── email/                 # SES identity, DKIM, config set, contact list/topics
│   ├── uploads/               # private/quarantine buckets, KMS, lifecycle, scanner
│   ├── scheduling/            # EventBridge schedule groups and execution roles
│   └── observability/         # dashboards, alarms, SNS, canaries, log retention
└── live/
    ├── org/us-east-1/         # keyTrain organization, OUs, member accounts
    ├── nonprod/us-east-1/     # ALV nonprod module wiring
    └── prod/us-east-1/        # ALV prod module wiring
```

Bootstrap state once with an S3 bucket that has Block Public Access, SSE-KMS, versioning, access
logging, and tightly scoped roles. Use the current S3 backend `use_lockfile = true`. Do **not** create
a DynamoDB table only for Terraform locking: HashiCorp now marks DynamoDB-based locking deprecated.
State data itself can contain secrets, so state access is more privileged than ordinary deployment.
See [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3).

Commit `.terraform.lock.hcl`, pin Terraform/provider major versions, and use separate state keys and
accounts for non-production and production. Workspaces alone are not an environment boundary.

### Resource inventory

The first implementation creates these Terraform-managed resource families:

- `aws_route53_zone/record`, `aws_acm_certificate/validation`, `aws_s3_bucket` and bucket controls,
  `aws_cloudfront_origin_access_control/distribution/cache_policy/response_headers_policy`, and
  `aws_wafv2_web_acl`.
- `aws_cognito_user_pool`, app clients, groups, domain, resource server/scopes, and SES integration.
- `aws_apigatewayv2_api`, stages, integrations, routes, JWT authorizer, domain, mappings, and access
  logs.
- `aws_lambda_function`, per-function roles/policies, permissions, versions/aliases, log groups, and
  reserved concurrency where downstream protection is required.
- Six `aws_dynamodb_table` resources described above, KMS keys/aliases, PITR, deletion protection,
  TTL only on ephemeral records, and CloudWatch alarms.
- Domain SQS queues and DLQs with queue policies, KMS encryption, redrive policy, visibility timeout,
  and alarms for oldest-message age/DLQ depth.
- SES domain identity/DKIM, configuration set/event destination, templates, contact list/topics, SNS
  handling for bounce/complaint events, and Route 53 SPF/DMARC records.
- Private upload/quarantine/export S3 buckets, bucket policies, KMS keys, CORS restricted to the real
  origin, lifecycle expiration, and malware scanning resources.
- EventBridge Scheduler schedule groups, execution roles, retry policy, and DLQ integration.
- CloudWatch dashboards/alarms, SNS incident topic, Synthetics canary, WAF/API/CloudFront logs, AWS
  Budgets, and Cost Anomaly Detection subscriptions.
- Account-level GuardDuty, Security Hub, Config, CloudTrail, Access Analyzer, backup policies, and
  organization delegation are managed from the landing-zone/security roots, not the app root.

### AMI decision

There are **no AMIs in the initial design** because no workload needs an operating system. Adding EC2
would create patching, vulnerability, scaling, and availability obligations without helping this
site. If a future vendor binary truly requires EC2, create an EC2 Image Builder pipeline, Inspector
scanning, SSM-only access, an Auto Scaling Group across Availability Zones, and automated AMI
replacement. Never maintain a hand-built “golden server.” AWS notes that custom-image owners remain
responsible for patching; see
[Image Builder patch management](https://docs.aws.amazon.com/imagebuilder/latest/userguide/security-patch-management.html).

### Network decision

Initial Lambdas remain outside a customer VPC because they call managed AWS APIs and DynamoDB; this
avoids NAT gateways and unnecessary subnet failure modes. API Gateway is the public ingress. No
database or Lambda receives a public IP.

If Aurora is approved later, add a two-or-more-AZ VPC with private database/application subnets,
RDS Proxy, restricted security groups, required VPC endpoints, and explicit egress. Do not add a NAT
gateway until a private function has a documented outbound-Internet dependency.

## CI/CD and release controls

GitHub Pages staging remains deployed by `.github/workflows/pages.yml`. It contains no secrets,
private data, or functioning staff portal.

Add these production workflows when AWS accounts exist:

1. `terraform-check.yml` on pull request: format, init, validate, TFLint, Checkov/tfsec, policy tests,
   speculative plan, and plan artifact. Fork PRs receive no AWS role.
2. `terraform-apply.yml` after merge: OIDC to nonprod, apply the reviewed commit, smoke test. Production
   uses a protected GitHub Environment with required customer/owner approval and applies the exact
   commit already tested in nonprod.
3. `production-site.yml`: build once, scan, upload hashed assets first and HTML last, set cache
   headers, invalidate only HTML/route paths, run canary, and automatically restore the previous S3
   version if health checks fail.
4. Backend function packages are content-addressed and promoted; production is not rebuilt from a
   different dependency set.

GitHub OIDC role trust must include repository, branch, workflow/environment, and audience claims.
Use GitHub Environment approvals for production. Never add `AWS_ACCESS_KEY_ID` or secret access keys
to repository secrets.

## Security, reliability, and load controls

- WAF managed common/known-bad-input rules plus rate-based rules for submit, login, and export routes.
  Add bot/CAPTCHA protection to anonymous mutation routes after testing accessibility.
- CloudFront long-cache hashed assets; short-cache/revalidate HTML; API caching only for public GETs.
- Lambda reserved concurrency protects SES and downstream systems. SQS absorbs bursts and provides
  backpressure. DynamoDB on-demand handles unpredictable initial traffic.
- Strict CSP, HSTS, referrer policy, permissions policy, MIME sniff protection, and no inline secrets.
- CloudWatch alarms: API 5xx/latency, Lambda errors/throttles/concurrency, DynamoDB throttles/system
  errors, queue age/DLQ depth, SES bounce/complaint rates, WAF blocks, canary failure, budget anomaly.
- Structured logs contain correlation ID, route, result, latency, and record ID only; no tokens,
  message bodies, emails, health data, or uploaded documents.
- DynamoDB PITR and AWS Backup restore testing; S3 versioning/lifecycle; quarterly restore exercise.
- Suggested launch objectives: public cached pages 99.9% monthly availability; dynamic workflows
  99.5% initially; RPO 15 minutes for application data; RTO four hours. Customer must approve these.
- Load test public traffic through CloudFront and mutation APIs separately. Acceptance is 2x agreed
  peak with no lost messages, oversold event capacity, or unbounded Lambda concurrency.

## Delivery order and exit criteria

### 0. Public staging — implemented now

- Responsive routes, GitHub Pages workflow, modular source, build/test checks.
- Prototype records and simulated integrations removed; honest empty states shown.
- Exit: customer approves layout and supplies authoritative content/data owners.

### 1. Landing zone and production static site

**1a. ALV tenant under KeyTrain — done 2026-08-31.** Existing payer, imported org, Identity Center
portal, ALV member accounts, org Terraform state. See [Current AWS status](#current-aws-status-2026-08-31--pick-up-here).

**1b. Still open.** Log-archive/audit/shared accounts, OIDC, SCPs, logging. Put S3/CloudFront/WAF
and retreat APIs in **ALV prod** first; use ALV nonprod only after that is good.

- Exit: private origin, edge protection, monitoring, rollback and budget alarms tested.

### 2. Content, event calendar, and subscriptions

- Deploy content/events API, staff event editor, ICS feed, event registration, newsletter consent,
  contact queue, SES domain and notifications.
- Exit: real record IDs, double opt-in/unsubscribe, DLQ recovery, capacity concurrency and audit tests
  pass; no static fallback records are bundled.

### 3. Staff identity and retreat intake

**MVP applied 2026-08-31** in ALV prod: invite-only Cognito, DynamoDB, HTTP API, public form, staff
review UI. Remaining: encryption/KMS, uploads, audit/export, retention, issue 37 privacy review.

- Exit: privacy/security review, access review, backup/restore, deletion, incident response and load
  test pass.

### 4. Optional member/AV Active services

- Define a real user-owned feature and mobile-product ownership before enabling public accounts.
- Exit: store applications and APIs are real; production URLs replace status copy.

## Required customer inputs before Terraform apply

- keyTrain management account ID, unique emails for each member account, Identity Center operator
  list, billing alerts and monthly budget.
- Domain registrar access, authoritative DNS decision, production/staging domain names.
- GitHub organization/repository owner and production environment approvers.
- Named data owner and retention period for each table/field; incident and deletion contacts.
- Whether AWS, GoHighLevel, or another vendor is the system of record for newsletter, contact,
  volunteer, and retreat applications.
- Approved staff roles and initial invite list; whether any public/member account is actually needed.
- Approved calendar publishing workflow, registration capacity rules, cancellation/reminder policy.
- SES sender/from/reply-to addresses and access to add DKIM/SPF/DMARC DNS records.
- Privacy policy, terms, consent language, accessibility owner, and legal review of sensitive retreat
  questions.
- Traffic assumptions, availability/RPO/RTO targets, log/audit retention, and support escalation.
- If ID.me is required: executed vendor agreement, sandbox/production credentials, approved claims,
  callback URLs, and privacy terms.

Until these inputs exist, Terraform implementation can be scaffolded and planned against nonprod,
but production data collection and account invitations must remain disabled.
