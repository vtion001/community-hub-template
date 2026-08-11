# Nav multi-page build + cozy palette switch — design

**Date:** 2026-08-12
**Project:** community-hub-template (Sig & Espresso)

## Problem

All 10 nav items (Events, Shop, Resources, Forum, Blog, Gallery, Learn, About, Contribute, Account) are currently dead `#` anchors with no matching content — clicking them does nothing. The site also needs to switch from its current dark-ink/amber theme to a light palette matching the logo (cream background, coffee-brown text, terracotta accent).

## Approach: Vite multi-page app (MPA)

Chosen over a client-side SPA router (adds routing complexity/new architectural concept for no benefit here) and over switching to a static-site generator like Astro/11ty (replaces a working toolchain mid-project). MPA is the smallest addition that gives real URLs and native browser back/forward with zero new dependencies.

11 real HTML entry points total: `index.html` (home, existing) + one per nav item:
`events.html`, `shop.html`, `resources.html`, `forum.html`, `blog.html`, `gallery.html`, `learn.html`, `about.html`, `contribute.html`, `account.html`.

## Architecture

- **`vite.config.ts`** — `build.rollupOptions.input` lists all 11 HTML entries.
- **`src/chrome.ts`** — shared nav + footer renderer, used by every page. Takes the active page slug so it can highlight the current nav item. Home page's existing inline nav/footer markup gets refactored to use this too, so there's exactly one implementation, not one-plus-ten copies.
- **`src/renderPage.ts`** — generic content-block renderer. Understands block types `text`, `list`, `cards`, `cta`. Adding a page later means adding data to `site.json`, not new render code.
- **`src/pages/<slug>.ts`** — one thin entry file per non-home page: import `chrome.ts` + `renderPage.ts`, call them with that page's slice of `site.json`. A few lines each.
- **`content/site.json`** — gains a `pages` object keyed by slug (`events`, `shop`, `resources`, `forum`, `blog`, `gallery`, `learn`, `about`, `contribute`, `account`), each with `title`, `intro`, and a `blocks` array. Still one JSON file, one source of truth — same principle as the existing home page.

## Data flow

Every page's TS entry: import `site.json` → `renderChrome(activePage)` → `renderPage(site.pages[slug])`. No page-specific render logic beyond what `renderPage.ts`'s block types already handle.

## Palette (switch, not a second theme)

Old dark-ink/amber tokens are removed and replaced:

| Token | Old | New | Source |
|---|---|---|---|
| `--color-bg` | `#14151A` | `#FBF3E7` | logo cream circle |
| `--color-fg` (text) | `#F2F0EA` | `#4A342A` | logo coffee-brown linework |
| `--color-accent` | `#FFB020` | `#D98255` | logo terracotta rim/steam |
| `--color-panel` | `#1C1D24` | a slightly deeper cream | derived, for footer-bar contrast against `--color-bg` |

**Side effect:** `public/images/hero-bg.svg` (the two original mascot line-art characters) is currently drawn in near-white low-opacity strokes, meant for a dark background — invisible on cream. Its stroke color will be recolored to a muted brown so the same artwork still reads on the new light background. This is a recolor, not a redesign — no new artwork, no change to the shapes/composition.

## Page content (all original; moderate depth — short intro + 2-4 blocks each)

| Page | Content |
|---|---|
| Events | Intro + the 3 established formats (casual meetups, show-and-tell, coworking) + "watch WhatsApp for dates" CTA |
| Shop | Intro + 2-3 placeholder merch cards (mug, tote, stickers) + "DM us on WhatsApp to order" (no cart/checkout — no backend exists for this) |
| Resources | Intro + curated category list (tools, gear guides, reads) |
| Forum | Explains discussion happens in the WhatsApp group, not separate forum software + join CTA |
| Blog | Intro + 2-3 post-stub cards (title + one-line teaser, "coming soon") |
| Gallery | Intro + placeholder caption cards (e.g. "Meetup #3") — styled blocks, not photos; no real event photos exist yet |
| Learn | Intro + list of learning formats (intro nights, workshops, pairing sessions) |
| About | Original story/values restating the established voice; explains the 5 membership tiers |
| Contribute | How to get involved (host an event, write a guide, help the site) + GitHub link |
| Account | Real page, no login/auth (none exists) — explains membership tiers, "join via WhatsApp" CTA |

## Error handling

`renderPage.ts` falls back to a "content coming soon" block if a slug's `site.json` data is ever missing. Defensive only — not a real failure mode, since all content is static and resolved at build time.

## Testing / QC plan

1. `npm run build` succeeds for all 11 entries.
2. Grep gates: no inline `style=`, no JS-based hover handlers, no reference-site content leakage.
3. Playwright QC per page, both viewports (1440×900, 390×844): zero console errors, zero `pageerror`, zero HTTP ≥400.
4. Nav click-through test: every nav item lands on the correct page, active-state highlight is correct, logo/brand link returns to home from every page.
5. Standard ship-loop REVIEW (sentinal security / verity QA / aesthetica UX) + GATE before this is considered done.

## Out of scope

- Real authentication/login for Account.
- Real e-commerce/cart/checkout for Shop.
- Real forum software — Forum page just explains that WhatsApp *is* the forum.
- Real event photography for Gallery — placeholder captions only until real photos exist.
- Any content copied or derived from ai-and-coffee.com or any other reference site — everything above is original, matching the project's existing IP boundary (see `README.md` → Origin).
