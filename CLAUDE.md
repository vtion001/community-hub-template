# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A reusable, data-driven landing-page template for community/maker-style sites (sticky nav, hero, member tiers, dual CTA, bottom audio-player footer). The **layout structure** was extracted from a reference site via `scripts/wireframe-extract.mjs` (geometry/type-scale/palette only — never copy or assets). All content, colors, fonts, and artwork here are original and currently populated for a placeholder brand ("Sig & Espresso").

## Commands

```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # production build -> dist/
npm run preview   # serve the production build
npm run test      # vitest run (all tests in tests/**/*.test.ts)
npm run qc        # scripts/qc-nav.mjs — Playwright nav click-through + console/HTTP error check across all 8 pages
```

- Single test file: `npx vitest run tests/chrome.test.ts`
- `npm run qc` expects a server already running; pass a base URL as an arg, e.g. `node scripts/qc-nav.mjs http://127.0.0.1:4400` (defaults to that address).

## Architecture

**Content/render split.** `content/site.json` is the single source of truth for every string, link, and list on the site — brand name, nav items, hero copy, member tiers, per-page blocks, audio track list. Nothing in `src/` hardcodes copy; changing the site means editing this JSON, not the TypeScript.

**Page rendering pipeline.** Each of the 8 root HTML files (`index.html` + one per nav item: `events.html`, `shop.html`, `blog.html`, `gallery.html`, `about.html`, `contribute.html`, `account.html`) is a real static file with its own `<script type="module">` entry:
- `index.html` → `src/main.ts` (bespoke hero layout)
- every other page → `src/pages/<slug>.ts`, a thin file that calls `renderHeader`/`renderFooter` from `src/chrome.ts` and `renderPage` from `src/renderPage.ts`, feeding it `site.pages.<slug>` from the JSON

`src/renderPage.ts` renders a content page as up to **three sections**, not one stacked column: header band (title/intro + mascot art), content band (the page's `text`/`list`/`cards` blocks, omitted entirely if there are none), and — only if the page data has a `cta` block — a separate highlighted CTA band pulled out of the normal flow. It also accepts an optional `{ afterHero: string }` to splice raw HTML in right after the header band — used by the Account page to place its membership card above the rest of the content (which for Account is empty, since the card carries everything).

**Account membership card.** The Account page (`src/accountAuth.ts`) is one persistent ticket-styled card, not separate login-panel-then-dashboard blocks. Its shell (border, ticket notches, a static tier-stamp illustration built from `site.hero.tiers` — never a personal progress indicator, since the backend doesn't track per-user tier) always renders; inside it, exactly one of a loading/guest/member region is visible via a hidden/show toggle driven by `/api/auth/me`. Guest and member regions each have their own internal tab switcher (Sign up/Log in, or Learn/Resources/Forum sourced from `content/site.json`'s `dashboard.sections` — Learn/Resources/Forum aren't standalone pages), both wired through one shared `wireTabGroup()` helper. Dashboard section content reuses `renderPage.ts`'s exported `renderBlocks()`.

`src/chrome.ts` owns the nav/footer shell shared by every page, including the sticky header (desktop nav + mobile `<details>` disclosure, active-link styling by slug) and the footer study-music player (`mountPlayer` wires play/pause/prev/next/progress/click-to-seek against `content/site.json`'s `player.tracks`).

**Base-path support.** `src/basePath.ts`'s `withBase()` prefixes root-absolute internal paths (`/events.html`, `/images/...`) with Vite's `BASE_URL` so the build still works when served under a URL prefix (e.g. a Tailscale Funnel path-mount). It's a no-op at the default base and passes external URLs/fragments through untouched. Every internal `href`/`src` in `chrome.ts` and `renderPage.ts` is wrapped in `withBase()` — new internal links must be too.

**Multi-page Vite build.** `vite.config.ts` registers all 8 HTML entry points in `build.rollupOptions.input` (keyed by the same page-slug list used elsewhere) — a new page needs an entry here in addition to the root `.html` file and `src/pages/<slug>.ts`.

**Styling.** Tailwind v4 via `@tailwindcss/vite`, with the entire palette/type/radius system defined as CSS custom properties in the `@theme` block of `src/style.css` (`--color-bg`, `--color-fg`, `--color-accent`, `--color-accent-text`, `--color-panel`, `--color-muted`, `--radius-brand`, `--font-mono`/`--font-sans` aliased to `.font-brand`). Components reference these via `var(--color-*)` in Tailwind arbitrary-value classes rather than Tailwind's default palette — match that pattern for new UI.

## Adding a new nav page

1. Add the nav entry to `content/site.json`'s `nav.items` and a `pages.<slug>` block (title/intro/blocks).
2. Add `<slug>.html` at the repo root (copy an existing one, point its script tag at `src/pages/<slug>.ts`).
3. Add `src/pages/<slug>.ts` following the pattern in an existing page file.
4. Add the slug to `pageSlugs` in `vite.config.ts` and to `PAGE_PATHS` in `scripts/qc-nav.mjs`.

## Testing conventions

Vitest tests run in the `node` environment (no DOM) and assert against the raw HTML strings returned by `renderHeader`/`renderFooter`/`renderPage` — no `jsdom`/mounting. `tests/content.test.ts` validates the shape of `content/site.json` itself; `tests/palette.test.ts` checks the theme tokens. Browser-level checks (real navigation, console/HTTP errors, mobile viewport) live only in `scripts/qc-nav.mjs`, run separately via `npm run qc` against a running server.
