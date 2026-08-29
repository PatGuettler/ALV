# Alabama Veteran Website Redesign — Project Context

> Imported from Claude.ai project on 2026-06-06

## Project Overview

Rebuilding the Alabama Veteran website (alabamaveteran.org) — a nonprofit serving Alabama's veteran community. All pages are developed as self-contained HTML files before eventual WordPress migration using the Divi theme. Chris Montz (President) is driving all site development decisions directly.

---

## Brand Standards

- **Fonts:** League Gothic and Libre Franklin
- **Colors:** Brave Blue (#48536A), Royal Red (#B21F24), Deep Navy (#1A2030 / --blue-dp)
- **Nav:** Red-accented nav with dark navy background
- **Cards:** Hover states flip to dark navy with red top accent
- **Global element:** Floating 988 Crisis Line button on all pages

---

## Key People

| Name | Role |
|---|---|
| Chris Montz | President / Project Lead |
| Chris Stricklin | VP |
| Jesse Elders | Secretary |
| Dylan Angeline | Parliamentarian |
| James "Mike" Oakley | Board Member |
| Matt Schlaugenhauf | Placeholder |
| Danny Noles | Placeholder |

---

## Current State — Locked Base Files (Approved May 2026)

| File | Page |
|---|---|
| `alabamaveteranv5compressed.html` | Homepage |
| `alabamaveteranv6retreatscompressed.html` | Warrior Retreat |
| `avcirclecompressed.html` | AV Circle |
| `avactivefinal.html` (from avactivecompressed) | AV Active |
| `avresourcescompressed.html` | Resources/Navigate page |

**Resources page details:** 74 resources across 10 categories (Crisis & Mental Health, VA & Vet Centers, Housing, Benefits & Claims, Healthcare, Education, Employment, Financial Assistance, Legal Help, Family & Caregivers, Transition Support). Includes all five Alabama VA Vet Centers with verified addresses, AVRC at 100 Dexter Ave, Montgomery (missionforwardal.org, opened February 2026), SAFER Together firearm safe storage program (Hoover and Pelham locations), and floating 988 button.

All pages are approved.

---

## Immediate Next Step

Merging all pages into one unified all-in-one HTML file.

Two additional WordPress page templates ready for deployment:
- `page-news.php` (News/Blog)
- `page-media.php` (Videos & Gallery — requires YouTube Data API v3 setup via `AVYTCHANNELID` and `AVYTAPI_KEY` in wp-config.php)

---

## On the Horizon

- **Full site merge** of all approved pages into one all-in-one HTML file
- **Two fundraising event landing pages** still in progress:
  - War on the Greens — awaiting video links, sponsorship/registration URLs, photo assets, sponsor tier details
  - Salute to Service — awaiting the same; 2026 gala being skipped in favor of revamped 2027 event; tone should build anticipation without suggesting discontinuation
- **WordPress deployment:** Migrating base64 images to hosted URLs in WordPress Media Library; deploying via Custom HTML block or WPCode plugin
- **Divi child theme folder setup** for PHP page templates

---

## Key Technical Learnings & Principles

**Minimal, targeted changes only** — Chris has flagged frustration when Claude rebuilds sections broadly or introduces regressions. Every edit must be surgical.

**Compression approach:**
- Extract base64 images, deduplicate via MD5 hash, convert all formats to WebP
- Large PNGs >1000px → 600px max at quality 82; small PNGs at quality 85; JPEGs → 1200px max at quality 75
- Consistently achieves 58–66% size reduction
- Use Pillow via `pip install Pillow --break-system-packages`

**CSS scoping:** All page-specific CSS must be scoped inside the page's container ID (e.g., `#page-circle`) to prevent bleed into shared nav/footer styles.

**JavaScript preservation during compression:** CSS-only minification should be used. Aggressive minification of JS string literals (especially apostrophes in arrays) breaks functionality.

**Navigation integrity:** All `showPage()` calls must match valid page IDs; bare `href="#"` links are intentional onclick navigation elements, not errors.

**Volunteer language flexibility:** Avoid "100% volunteer-run" — use language like "built by Alabamians, for Alabama's veterans" and "built on community support and donations since 2016" to remain accurate if paid staff are hired.

---

## Approach & Patterns

- Works iteratively — reviews output at each step before proceeding; confirms approval before locking files
- Keeps all files compressed to conserve chat context space
- Treats the most recently approved compressed file as the authoritative locked baseline; never modifies approved files without explicit instruction
- Multi-page site uses a JavaScript-driven `showPage()` navigation system within a single HTML file
- WordPress deployment target: Divi child theme, Custom HTML blocks, or WPCode plugin

---

## Tools & Resources

- Python3 + Pillow for image processing and compression
- WordPress with Divi theme (hosting target)
- YouTube Data API v3 (for media page)
- WPCode plugin (for HTML block deployment)
- CDN-hosted logos: `assets.cdn.filesafe.space`
- Output path: `/mnt/user-data/outputs/`

---

## Conversation History (from Claude.ai project)

Conversations in chronological order (most recent first):

1. Preparing for deployment (May 28)
2. Redesigning fundraising pages for new site layout (May 28)
3. Alabama veteran resources page compilation (May 27)
4. Updating about page and board of directors (May 27)
5. Building compressed WordPress pages (May 27)
6. Compressing content for photo integration (May 27)
7. Building out the next page (May 27)
8. Consolidating and migrating website to WordPress (May 27)
9. Warrior retreat page compression (May 27)
10. Reviewing warrior retreat site progress (May 27)
11. Warrior retreat page redesign and navigation restructuring (May 27)
12. Alabama veteran page redesign (May 27)
13. Alabama Veteran website redesign (May 26)
