# Community Hub Template

A reusable, data-driven landing-page template for community/maker-style sites — sticky nav, stacked mono headline, tagline stack, member-tier list, dual CTA, decorative hero illustration, and a bottom audio player bar.

## Origin

The **layout structure only** was extracted from a reference site using `scripts/wireframe-extract.mjs`, which captures section geometry, type scale, and palette sampling — never copy, images, or brand assets. See `docs/design/` for the captured blueprint.

All content, colors, fonts, and artwork in this template are original:
- Copy: `content/site.json` (currently populated for "Sig & Espresso" — replace for your project)
- Palette: cream `#fbf3e7` background / coffee-brown `#4a342a` text / terracotta `#d98255` accent (own token set in `src/style.css`), matching the logo
- Logo + mascot illustration ("Nova" the AI/tech character and "Circle" the community character): hand-authored original SVGs in `public/images/`
- WhatsApp group copy (full/short/pinned-message versions) + real invite link: `docs/whatsapp-description.md`

The WhatsApp join link is now live in both `nav.cta.href` and `hero.ctaPrimary.href` in `content/site.json`.

## Audio player

The footer is a study-music player (play/pause, prev/next, progress bar, track counter) instead of a status ticker. Track list lives in `content/site.json` under `player.tracks`.

> **Placeholder audio:** `public/audio/placeholder-01.mp3` through `-15.mp3` are short synthesized sine-wave tones (generated locally with `ffmpeg`, not real music) — they exist only so the player is fully testable end to end. Replace them with real, properly licensed instrumental tracks before this goes live: swap the files in `public/audio/` and update the `title`/`src` fields in `content/site.json`'s `player.tracks` to match.

## Page layout

Every content page (`src/renderPage.ts`, shared by all 7 nav pages) renders as up to three distinct sections, not one long stacked column:
1. **Header band** — page title + intro, panel background, mascot illustration on the right (desktop only)
2. **Content band** — the page's list/cards/text blocks
3. **CTA band** (only when the page has a `cta` block) — pulled out into its own highlighted closing section, separate from the rest of the content

## Using this template

1. Edit `content/site.json` — brand name, nav items, hero copy, tiers, links.
2. Swap `public/images/logo.svg` and `public/images/hero-bg.svg` for your own artwork (or hand-edit the originals).
3. Adjust theme tokens in `src/style.css` (`@theme` block) for a new palette/type.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # outputs to dist/
npm run preview    # serve the production build
```

## Structure

```
content/site.json        # all page copy — single source of truth
public/images/           # original logo + hero illustration (SVG)
src/main.ts               # renders the page from site.json
src/style.css              # Tailwind v4 + theme tokens
scripts/wireframe-extract.mjs   # structural-extraction tool (re-run against any reference site)
docs/design/              # captured wireframe blueprint + build screenshots
src/chrome.ts             # shared nav/footer renderer (pure functions)
src/renderPage.ts         # generic page-body renderer (text/list/cards/cta blocks)
src/pages/                # one thin entry file per nav page
*.html (root)              # 8 real pages: index + one per nav item
tests/                     # vitest unit tests for chrome.ts, renderPage.ts, content shape, palette
scripts/qc-nav.mjs         # Playwright QC: nav click-through + console/error checks across all pages
public/audio/              # study-music player tracks (currently placeholder tones — see Audio player above)
```
