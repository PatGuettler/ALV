# Alabama Veteran — Developer Handoff
**Site:** alabamaveteran.org  
**Organization:** Alabama Veteran (501c3 nonprofit)  
**Contact:** Chris Montz — c.montz@alabamaveteran.org  
**Prepared:** June 2026

---

## What This Is

This is a fully designed, production-ready website for Alabama Veteran. All design work is complete — every page, layout, style, interaction, and image is finished and working. Your job is to host it in WordPress using the Divi theme. This is a deployment task, not a design or rebuild task.

The site is a single HTML file (`avactivefinal_compressed.html`). All CSS, JavaScript, and images are embedded inside it. It uses a custom `showPage()` JavaScript function to handle navigation between pages within the file. There is no build system, no npm, no framework — it is plain HTML, CSS, and vanilla JavaScript.

**Estimated deployment time for an experienced WordPress/Divi developer: 4–8 hours.**

---

## Local File Path

```
C:\Users\chris\Claude\Projects\Website redesign concept\
```

---

## Full File Structure

```
Website redesign concept/
│
├── avactivefinal_compressed.html        ← MASTER FILE — use this one
│
├── warrior-retreat-application.html     ← Standalone Warrior Retreat application form
│
├── FINAL DELIVERABLE/
│   ├── alabamaveteran_website_FINAL.html  ← Superseded, ignore
│   └── warrior-retreat-application.html  ← Copy of the application form
│
├── DEVELOPER_HANDOFF.md                 ← This file
├── WordPress Launch Checklist - Developer Handoff.md
├── PROJECT_CONTEXT.md
├── Site Audit - June 13 2026.md
├── Topgolf_Veterans_Procedure_v4_1.docx
├── 9line-crisis-form.jpg / .png
│
└── (older versions — ignore)
    avactivefinal.html
    avactivefinal_master.html
    avactivefinal_master_FINAL.html
    avactivefinal_master_v2.html
    avactivefinal_store.html
```

**Only use `avactivefinal_compressed.html`.** Everything else is superseded.

---

## Pages Included

All 10 pages are inside `avactivefinal_compressed.html` as `<div id="page-[name]" class="page">` sections.

| Page ID | Nav Label | Notes |
|---|---|---|
| `home` | Home | Hero, stats bar, mission cards, volunteer CTA |
| `news` | News | News/updates section |
| `warrior` | Warrior Retreat | Men's, Women's, Endurance, Marriage, Peer-to-Peer retreat programs |
| `circle` | AV Circle | Membership/community program |
| `active` | AV Active | Fundraising cards: War on the Greens + Salute to Service |
| `topgolf` | — | Topgolf event page (internal nav link, not in main nav bar) |
| `events` | Events | Interactive JS calendar + monthly event strip + calendar subscribe links |
| `store` | Store | GHL store embed placeholder — ready to receive GHL embed code |
| `resources` | Resources | 98 veteran resources across 11 categories with live search/filter |
| `about` | About | Board members, mission, org info |

There is also a **standalone file** — `warrior-retreat-application.html` — a multi-step application form that lives separately from the master file. Host it as its own WordPress page using a blank template, or replace it with a GHL multi-step form embed.

---

## Brand Specs

- **Fonts:** League Gothic (headings) + Libre Franklin (body) — Google Fonts CDN
- **Colors:** Brave Blue `#48536A` · Royal Red `#B21F24` · Deep Navy `#1A2030`
- **Nav:** Dark navy background, red underline on active page
- **Cards:** Hover flips to dark navy with red top accent
- **Floating button:** 988 Veteran Crisis Line — on every page, must be preserved

---

## How to Deploy in WordPress + Divi

This is the recommended path. It takes a single afternoon.

### Step 1 — Install WordPress + Divi

Standard WordPress install. Activate Divi theme. Install the **WPCode** plugin (free) — you'll use it to add global CSS and JS.

### Step 2 — Add Global CSS

Open `avactivefinal_compressed.html` in a text editor. Everything between the first `<style>` tag and the opening `<nav>` tag is global CSS. Copy it. Paste it into **Divi > Theme Options > Custom CSS** (or WPCode as a CSS snippet set to run site-wide).

### Step 3 — Add Global JavaScript

In the HTML file, locate the `<script>` blocks that contain the `showPage()` function, the `AV_EVENTS` array, and the `RESOURCES` array. Copy those scripts. Paste them into WPCode as a JavaScript snippet set to run site-wide in the footer.

### Step 4 — Add Google Fonts

In Divi > Theme Options > General > Google Fonts, add:
```
https://fonts.googleapis.com/css2?family=League+Gothic&family=Libre+Franklin:wght@400;700;900&display=swap
```
Or add this link tag to the `<head>` via WPCode.

### Step 5 — Create WordPress Pages

Create one WordPress page for each of the 10 pages listed above. For each page:

1. Set the Divi page template to **Blank Canvas** (removes Divi's default header and footer — the site uses its own custom nav and footer)
2. Add a single **Divi Code module** to the page
3. Open `avactivefinal_compressed.html`, find the corresponding `<div id="page-[name]">` section, and copy its full contents into the Code module

The custom `<nav>` and `<footer>` from the HTML file should be added to a global Divi header/footer using the **Divi Theme Builder**, or pasted via WPCode to appear on every page.

### Step 6 — Host the Warrior Retreat Application

`warrior-retreat-application.html` is a standalone form. Either:
- Create a WordPress page using a blank template and paste the file's HTML into a Code module, or
- Replace it with a GHL multi-step form embed (preferred long-term)

### Step 7 — Images

All 31 images are base64-encoded and embedded in the HTML — **they work as-is and do not need to be extracted for launch.** The file is 4MB total as a result, which is acceptable for a hosted site. 

If you want to optimize post-launch, extract each base64 string, upload to WP Media Library, and replace the `data:image/...;base64,...` src values with the hosted URLs. This is optional and can be done after go-live.

### Step 8 — Wire Up Forms and GHL

See the Dynamic Features section below for what needs to be connected.

---

## Dynamic Features — What Needs Wiring

Most of the site is fully static and works without any backend. These are the only items that need active wiring:

| Feature | Current State | Action Required |
|---|---|---|
| **Email signup forms** (footer + inline) | Shows a thank-you message only — does not submit data anywhere | Replace `<form class="su-fields">` with a GHL form embed code from your GHL account |
| **Contact form** | Opens user's local email client via `mailto:` — not a real submission | Replace with a GHL form embed or WPForms/Gravity Forms plugin |
| **Store page** | GHL iframe placeholder — ready and waiting | Set up products in GHL under Payments > Products, grab the embed/iframe URL, paste into `<div class="str-ghl-wrap">` and delete the `<div class="str-placeholder">` block |
| **Warrior Retreat application** | Standalone HTML form with no backend | Host as a WP page or swap with a GHL multi-step form |

Everything else — all layouts, the events calendar, the resource directory, all navigation, all GHL booking links — works out of the box with no changes.

### Live GHL Widget URLs Already in the File
These are already wired and functional:
```
app.alabamaveteran.org/widget/form/t9pQuFrpT0Yz2lYTwLVj   (newsletter signup)
app.alabamaveteran.org/widget/form/oA6BYtFTZ47lbNChjt2h   (volunteer signup — "Volunteer Now" button)
app.alabamaveteran.org/widget/bookings/top-golf-k4tal       (Topgolf event booking)
```
Verify each is live before launch.

---

## Key Links Already in the File

- Donate button: `https://onecau.se/alvet`
- Volunteer Now: `https://app.alabamaveteran.org/widget/form/oA6BYtFTZ47lbNChjt2h`
- 988 Crisis Line: `tel:988`
- Emails: `info@alabamaveteran.org` · `c.montz@alabamaveteran.org` · `avactive@alabamaveteran.org` · `gala@alabamaveteran.org`

---

## Pre-Launch Checklist

- [ ] WordPress + Divi installed, WPCode plugin active
- [ ] Global CSS added to Divi or WPCode
- [ ] Global JS added via WPCode (footer, site-wide)
- [ ] Google Fonts link added to `<head>`
- [ ] Custom nav and footer added via Divi Theme Builder or WPCode
- [ ] All 10 pages created as Blank Canvas pages with Code modules
- [ ] Warrior Retreat application hosted (WP page or GHL form)
- [ ] Email signup forms replaced with GHL form embeds
- [ ] Contact form replaced with GHL or WPForms
- [ ] GHL store set up (Payments > Products) and embed pasted into Store page
- [ ] Verify all three GHL widget URLs are live
- [ ] SSL certificate active
- [ ] Test 988 floating button on all pages
- [ ] Test all nav links
- [ ] Confirm Donate button links to `https://onecau.se/alvet`
- [ ] Mobile responsive check

---

## Additional Reference Files

- `WordPress Launch Checklist - Developer Handoff.md` — supplemental WP-specific notes
- `Site Audit - June 13 2026.md` — June 2026 audit notes
- `PROJECT_CONTEXT.md` — full internal project history and design decisions
