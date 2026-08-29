# Alabama Veteran Website — WordPress Launch Checklist

**Prepared for:** Web developer handling the WordPress deployment
**Prepared by:** Alabama Veteran (Chris Montz, President)
**Last updated:** June 13, 2026

---

## What you're working with

The site is a finished, hand-coded multi-page website delivered as a single HTML file.

- **File:** `FINAL DELIVERABLE/alabamaveteran_website_FINAL.html`
- **Size:** about 4.18 MB. Roughly 96% of that is images encoded directly into the file as base64.
- **Structure:** One HTML file containing every page. Navigation is handled in JavaScript (a `showPage()` function shows and hides page sections), so the whole site currently lives at a single web address.
- **Already mobile-responsive:** Proper viewport meta tag, fluid headline sizing, and mobile breakpoints from 340px phones up through tablets and desktop. No conversion needed. Please still test on real devices.
- **Pages included:** Home, Warrior Retreat, AV Circle, AV Active, Resources/Navigate, About.
- **Persistent element:** A floating 988 Crisis Line button appears on every page. Keep it visible after deployment.

---

## Recommended approach: load the code, do not rebuild in Divi

The fastest way to keep the exact look is to load the existing HTML directly rather than recreating it with Divi modules.

- Use a **Custom HTML / Code block** or the **WPCode plugin** to drop in the markup.
- Do **not** rebuild the design page by page in the Divi builder. That loses the custom styling and is a large amount of unnecessary work.
- WordPress simply serves the existing code, so the page renders exactly as built.

If the goal were the simplest possible hosting with no plugins, a static host would also work. Since the project is already set up on WordPress with Divi, the code-block route is the right call.

---

## Pre-launch tasks (do these before going live)

### 1. Move images out of the HTML and into the Media Library
This is the most important performance step.

- The file is heavy because images are embedded as base64.
- Upload each image to the WordPress Media Library.
- Replace the base64 strings in the HTML with the hosted image URLs.
- This drops the page from about 4 MB to a small fraction of that and makes it load fast, especially on mobile data.
- CDN already in use for some assets: `assets.cdn.filesafe.space`.

### 2. Load the brand fonts
The design depends on two fonts. Enqueue them in the Divi theme (or load via Google Fonts) so they render correctly.

- **League Gothic** (headlines and large display text)
- **Libre Franklin** (body text, subheads, buttons)

### 3. Decide on page structure and SEO
Right now the entire site is one URL with JavaScript switching between sections.

- For a simple brochure site, one page can be fine.
- If you want each section (Resources, Warrior Retreat, AV Circle, AV Active, About) to have its **own shareable web address** and rank properly in search, split them into real WordPress pages.
- Please flag your recommendation to Chris before launch so we can decide together.

### 4. Handle the PDF flyer modals
On the AV Active page, the War on the Greens flyers (sponsorship and team registration) are shown as base64 image previews with a download button for the original PDF.

- Upload the original PDFs to the Media Library or an external host.
- Point the download links to the hosted PDF URLs.

### 5. Confirm the brand colors render correctly
Use only these. Do not let any theme default override them.

- Brave Blue `#48536A`
- Royal Red `#B21F24`
- Deep Navy `#1A2030`
- Just White `#FFFFFF`

---

## AV News blog (build as native WordPress)

The site has an **AV News** link in the main navigation and a **"Latest From Alabama Veteran"** strip on the homepage. These are placeholders for a blog.

Build the blog as **native WordPress posts**, not as part of the hand-coded HTML file. WordPress is built for this and gives each post its own URL, which is what drives the SEO benefit.

- **Current placeholder behavior:** the AV News nav link, the three homepage cards, and the "View All News" link all route to an internal "AV News — Coming Soon" page (`#page-news`, shown via `showPage('news')`) so nothing hits a dead link during the demo phase. On launch, repoint these to the real WordPress blog at `/news`.
- Set the WordPress blog (posts page) to live at `/news`.
- The homepage **"Latest From Alabama Veteran"** strip currently shows three placeholder cards. Wire it to automatically pull the three most recent published posts from the blog (title, category, date, excerpt, link). It's marked with an HTML comment in the code: `<!-- AV NEWS strip: PLACEHOLDER ... -->`.
- Once the blog is live, each card and the "View All News" link should point to the live post / the `/news` archive, and the `#page-news` Coming Soon section can be removed.
- Keep the styling that's already there (League Gothic headings, Royal Red accents). The cards are styled in `<style id="avnews-styles">`.
- Content direction from Alabama Veteran: posts will target what Alabama veterans search for (filing VA claims in Alabama, county benefits, retreat recaps, legislative updates). Local plus specific topics.

---

## Placeholder links to wire up

These are intentionally inactive in the current file. Activate them when the destinations are ready.

- **Military Resume Translator** (Resources page): the red "Launch the Translator" button currently points to `href="#"`. Replace it with the real tool URL and remove the small "Coming Soon" tag.
- **Veteran Job Board** (Resources page): the outlined "Veteran Job Board — Coming Soon" button. Point it to the job listings page once it exists. Job listings are planned for this Resources page.
- **App Store and Google Play badges** (AV Active page): currently dimmed with a "Coming Soon" banner and `href="#"` links. Swap in the real store URLs, remove the banner, and bring the badges to full opacity when the app launches.

---

## Newer features added June 13, 2026 (wiring notes)

- **Mobile menu:** the nav now has a hamburger button that opens the menu on screens under 900px (`toggleMenu()`), and the menu closes automatically on navigation. No action needed, just confirm it on real devices.
- **Email signup:** styled newsletter signup appears in the footer (site-wide) and on the AV News page. It is a placeholder. Each one is marked with `<!-- GHL: replace this form ... -->`. Replace the inner form with the GoHighLevel newsletter form embed so submissions drop into the GHL database. Until then, the form shows a local "thanks" confirmation only.
- **Contact popup:** the footer "Contact Us" link and several CTA buttons (Learn More, Inquire About Sponsorship, Get Early Access) now open a contact modal instead of the old site. On submit it composes an email to info@alabamaveteran.org via the visitor's mail client (no backend). If you prefer submissions to land in GHL, swap the modal form for a GHL contact form embed.
- **Resources:** three new categories added (Women Veterans, Adaptive Sports & Recreation, Substance Use & Recovery), plus a "Suggest a Resource" button (opens the contact modal) and a "Print This Guide" button (uses a print stylesheet that outputs a clean, full resource list). Resource data lives in the `RESOURCES` array in the resources page script.

## Known fixes pending (see Site Audit - June 13 2026.md)

A full audit was run June 13, 2026. Key items for the developer:
- Several links still point to the old alabamaveteran.org site for content that now exists on the new site (Resources/Navigate, Events/Connect, About, Board, War on the Greens, Gala). These should route in-site. Full list in the audit doc.
- Warrior Retreat apply buttons (the 4 application CTAs: "Apply for a Retreat" x2, "Apply Now" x2) link to **warrior-retreat-application.html** (relative). A copy of that file now sits alongside the site file so it works when opened locally and travels with the handoff. **For the live site:** follow the application's own setup guide (Website_Deploy/README-WordPress-Setup.md) — upload warrior-retreat-application.html and iframe-embed it on a dedicated page (e.g. /warrior-retreat-application), then point these four buttons at that live page URL. The app also has pending backend work noted in its README (ID.me verification and the GoHighLevel handoff).
- The Warrior Retreat "Learn More" button now routes to the Warrior Retreat page itself (showPage('warrior')).
- Volunteer/Ambassador links (/engage/) should point to the GHL volunteer form for consistency.
- One image missing alt text; Resources search box needs an aria-label.
- Security is clean (all new-tab links use rel=noopener, all https, no third-party scripts). Standard WordPress hardening recommended; add spam protection when wiring GHL forms.

## Resource directory — keeping it current after launch

The Resources page lists ~120 veteran/military resources, stored as a JavaScript `const RESOURCES=[...]` array inside the page. A "Directory last reviewed / Next review by" date stamp shows at the bottom of the page, and an automated review runs about every 60 days (a scheduled task on the org's machine) to add new Alabama organizations, remove defunct ones, verify phones/links, and refresh that date stamp.

**Important for deployment:** that automated review updates the *local master HTML file*, not the live WordPress site. After each review, the updated resource list must reach the live site. Three options, in order of effort:

1. **Manual push (launch with this):** after each 60-day review, copy the updated page/array into the live WordPress page. A human step every two months.
2. **Auto-push via WordPress REST API:** wire the review task to update the page directly through the WP REST API (needs WordPress admin credentials/application password). Eliminates the manual step.
3. **Data-driven (best long-term):** store the resource list as data the page pulls in (a JSON feed or a WordPress custom post type / list the page reads) so updates appear live without re-deploying the HTML. Larger build, but the directory then stays current on its own.

Recommendation: launch with option 1, move to option 2 or 3 once the site is live and hosting/credentials are known. If the developer can advise on the cleanest path for this WordPress + Divi setup, the org is open to it.

## Post-launch checks

- Open every page on a real phone and tap through the full menu.
- Confirm the 988 Crisis Line button appears and works (tap to call) on mobile.
- Test every form and external link (donation, volunteer signup, AV Circle mailto links, missionforwardal.org).
- Run the live site through a page-speed test after images are moved to the Media Library.
- Confirm fonts load on first visit with no flash of a fallback font.

---

## Quick reference

| Item | Detail |
|------|--------|
| Master file | `FINAL DELIVERABLE/alabamaveteran_website_FINAL.html` |
| Platform | WordPress + Divi theme |
| Suggested load method | WPCode plugin or Custom HTML / Code block |
| Fonts | League Gothic, Libre Franklin |
| Brand colors | `#48536A`, `#B21F24`, `#1A2030`, `#FFFFFF` |
| CDN in use | assets.cdn.filesafe.space |
| Contact | Chris Montz, c.montz@alabamaveteran.org |

---

*This site is the property of Alabama Veteran. Please keep the design, colors, and fonts intact. Any questions before or during deployment, contact Chris directly.*
