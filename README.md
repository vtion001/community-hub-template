# Community Hub Template

A reusable, data-driven landing-page template for community/maker-style sites — sticky nav, stacked mono headline, tagline stack, member-tier list, dual CTA, decorative hero illustration, and a bottom status bar.

## Origin

The **layout structure only** was extracted from a reference site (`ai-and-coffee.com`) using `scripts/wireframe-extract.mjs`, which captures section geometry, type scale, and palette sampling — never copy, images, or brand assets. See `docs/design/ai-coffee/WIREFRAME.md` for the captured blueprint.

All content, colors, fonts, and artwork in this template are original:
- Copy: `content/site.json` (currently populated for "Sig & Espresso" — replace for your project)
- Palette: dark ink `#14151A` / amber accent `#FFB020` (own token set in `src/style.css`)
- Logo + hero illustration: hand-authored original SVGs in `public/images/`

> **TODO (Sig & Espresso launch):** `hero.ctaPrimary.href` in `content/site.json` is a
> placeholder (`#join-whatsapp`). Replace it with the real WhatsApp group invite link
> before going live.

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
```
