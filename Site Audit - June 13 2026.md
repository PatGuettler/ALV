# Alabama Veteran Website — Full Audit

> Historical audit of a deleted monolithic concept file. It does not describe the current staging
> build. See `MOCK_DATA_AUDIT.md` for removed prototype behavior and run the current automated checks
> documented in `README.md`.

**Date:** June 13, 2026
**File audited:** FINAL DELIVERABLE/alabamaveteran_website_FINAL.html
**Overall status:** Healthy. Navigation, scripts, and structure all check out. The main items to address are a set of links that still point to the old website, one group of buttons pointing to the wrong place, and a short list of security and polish recommendations for launch.

---

## RE-AUDIT June 14, 2026 (all 9 pages, 114 links)

**Historical result:** This paragraph described the retired concept. Its nonfunctional resource
tools, store buttons, news cards, calendar feed, and retreat prototype are not in the current build.

**RESOLVED June 14, 2026** — all 7 footer/About old-site links now route to the new in-site pages (Our Events → Events, Our Resources + Navigate Resources → Resources, Our Initiatives + About Us + Board of Directors → About, War on the Greens + Salute to Service Gala → Events). All 4 volunteer/ambassador links (Get Involved, Become an Ambassador, Become a Volunteer, footer Volunteer) now open the GHL form (app.alabamaveteran.org/widget/form/oA6BYtFTZ47lbNChjt2h).

**Intentionally still external (correct as-is):**
- "Get Help Now / 9 Line" crisis links → /nine-line/ (works on old site; keep until that page is rebuilt).
- War on the Greens "Sponsorship Info" and "Register Team" → events.alabamaveteran.org funnel pages. Live and working; confirm they are the current 2026 pages.
- Calendar subscribe feeds (Google/Apple/Outlook/.ics), "Find a VSO" → va.alabama.gov, "Our Financials" → ProPublica. All correct external links.

---

## 1. Links that still send users to the OLD site (original June 13 audit below)

This was the priority check. There are 24 links to the old alabamaveteran.org site. They fall into four groups.

### Group A — Fix these: content already exists on the new site
These should route inside the new site instead of bouncing to the old one.

| Where | Link text | Currently goes to | Should go to |
|-------|-----------|-------------------|--------------|
| Events footer column | "Our Events" | /connect/ | Events page (showPage 'events') |
| Events footer column | "Our Resources" | /navigate/ | Resources page (showPage 'resources') |
| Events footer "Get Help" | "Navigate Resources" | /navigate/ | Resources page |
| Events footer column | "Our Initiatives" | /about/ | About page |
| Events footer column | "Board of Directors" | /about/board-of-directors/ | About page (board section) |
| Events footer column | "War on the Greens" | /war-on-the-greens/ | Events page, War on the Greens card |
| Events footer column | "Salute to Service Gala" | /gala/ | Events page, Salute card |
| About page | "About Us" | /about/ | About page |

### Group B — RESOLVED (June 14, 2026)
The four Warrior Retreat apply buttons ("Apply for a Retreat" x2, "Apply Now" x2) now point to **/warrior-retreat-application**. The developer must deploy the application page (warrior-retreat-application.html, from the "Warrior Retreat Application and Automation" project) at that path so the links resolve on the live site.

Still open: the Warrior Retreat "Learn More" button still points to old /about/ and needs a proper destination (kept off the application link by request).

### Group C — Acceptable to keep for now (old site, still working)
These point to old-site pages that still function. Fine to leave until those pages are rebuilt, but worth migrating eventually.

- "9 Line / Get Help Now" crisis links → /nine-line/ (6 places). Crisis help, keep working.
- Calendar "Download .ics" → /connect/?ical=1. This is the live calendar feed, leave as is.

### Group D — Recommend repointing to your GHL form
Volunteer and ambassador links go to the old /engage/ page. Your "Volunteer Now" button already uses a GHL form, so these should match it for consistency.

- "Get Involved", "Become a Volunteer", "Become an Ambassador", footer "Volunteer" → /engage/ (4 places)

---

## 2. Functional checks (all passing)

- Every navigation item maps to a real page section. No broken page routes.
- All "#" links have a working click action. No truly dead links.
- No duplicate element IDs.
- The resource data and page scripts pass a JavaScript syntax check.
- Search now works (fixed tonight), category bar wraps so nothing is cut off (fixed tonight), mobile menu works (added tonight).
- Topgolf page is intentionally not in the main menu (part of AV Active), reachable from its linked button only.

---

## 3. Security review

### Already in good shape
- Every link that opens a new tab uses rel="noopener", which prevents tab-hijacking. No gaps found.
- No insecure (http) content. Everything loads over https, so no mixed-content warnings.
- No third-party scripts embedded. The only external asset is Google Fonts. Smaller attack surface.
- No duplicate IDs or obvious markup issues.

### To address at or before launch
- **Form spam protection.** When the email signup and contact form are wired to GHL, turn on GHL's spam/bot protection (and a CAPTCHA on the contact form). The current contact popup uses a plain email link, which is fine but offers no spam filtering.
- **Email harvesting.** The address info@alabamaveteran.org appears in plain text 6 times, which spam bots can scrape. Once the GHL contact form is live, consider routing people to the form instead of showing the raw address everywhere.
- **WordPress hardening (standard, for the developer):** force HTTPS site-wide, keep WordPress, Divi, and all plugins updated, use strong admin passwords with two-factor login, limit login attempts, install a reputable security plugin (such as Wordfence or Sucuri), and schedule automatic backups.
- **Note on inline scripts:** the site uses inline JavaScript. If the developer adds a Content Security Policy later, it will need to allow inline scripts or use nonces.

---

## 4. Accessibility quick wins

- One image is missing alt text (the War on the Greens initiative image). Add a short description.
- The Resources search box has placeholder text but no accessible label. Add an aria-label so screen readers announce it.
- The mobile menu button already has a proper label. Good.

---

## 5. Recommendations to improve use and functionality

- **Move images to the Media Library before launch.** The file is about 4MB because images are embedded directly. Hosting them properly will make the site load far faster, especially on mobile.
- **Give each section its own page URL for SEO.** The whole site is currently one address. Real page URLs help Google and make pages shareable. Most important once AV News and the blog go live.
- **Wire up GHL** for the email signup and (optionally) the contact form so submissions land in your database.
- **Add website analytics** (Google Analytics 4) so you can see what veterans use most and where they drop off.
- **Confirm the retreat application path** (Group B above), since that is a core action and currently leads nowhere useful.

---

## Suggested order for the morning

1. Repoint Group A links to the in-site pages (quick, no outside info needed).
2. Get the correct retreat application URL and fix Group B.
3. Repoint Group D volunteer links to the GHL form.
4. Add the missing alt text and the search aria-label.
5. Everything else (images to Media Library, page URLs, analytics, GHL wiring) is part of the WordPress launch handoff.
