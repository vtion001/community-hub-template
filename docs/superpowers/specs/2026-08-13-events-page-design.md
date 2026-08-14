# Events page redesign — design

**Date:** 2026-08-13
**Project:** community-hub-template (Sig & Espresso)

## Problem

The Events page is currently the thinnest possible use of the shared page template (`renderPage.ts`): an intro sentence, one flat bullet list of the 3 recurring formats, and a CTA. It doesn't feel purpose-built, and the underlying block system (`text` / `list` / `cards` / `cta`) has no way to visually differentiate items within a group or to label two distinct content groups on the same page — both of which this page needs.

This is the first page in a page-by-page review of the whole site (Events → others, each getting its own brainstorming pass). Changes here to the shared rendering system should be generically reusable by later pages, not Events-specific hacks.

## Luma investigation (context for the "Where" section below)

Researched whether real event data (e.g. from Metro Manila and other locations) could be pulled from Luma (lu.ma):

- **Official REST API** (`public-api.luma.com`) requires a **paid Luma Plus subscription** on the calendar being accessed, authenticated via a secret `x-luma-api-key` header. It's a "manage your own calendar" API — there is no endpoint to discover/browse public events across Luma by city; `GET /v1/calendars/events/list` only returns events on a calendar you already own and hold a key for.
- **No official MCP server exists.** The complete official doc index (`docs.luma.com/llms.txt`) has zero sections on MCP, public discovery, or unauthenticated access. Only unofficial third-party scrapers/wrappers exist, which still sit on the same paid API key or scrape undocumented pages — not something to depend on for this site.
- **Free embed widget** (Calendar → Settings → Embed) needs no API key or paid plan, but only shows events from a calendar you already own, and is a fixed-look, non-customizable iframe that can't be restyled to match the site's palette/block system.
- **Critical architectural constraint:** this site is 100% static (Vite build → static files, no server). A Luma API key is a secret and can never ship in client-side JS. Real API integration would need either a backend proxy (new infra this project doesn't have) or a build-time fetch baking results into the static output.
- **Blocking prerequisite, independent of all of the above:** no Luma calendar exists yet for this community, in any city. Confirmed directly — there is nothing to embed or fetch today.

**Decision:** defer any real Luma integration (embed or API) to its own future spec, once a real Luma Plus calendar with real events actually exists. This spec adds a "Where" section that is honest about that status today and is structured (an array of location entries) so a real entry can be added later without a redesign.

## Approach

Extend the existing `cards` block type with an optional per-item `tag`, and add one new small `heading` block type — both are minimal, reusable additions to `renderPage.ts`'s existing block system, rather than one-off markup in `src/pages/events.ts`. This was chosen over:
- **A dedicated `featureList`/numbered-editorial block type** — more code for a payoff that's mostly aesthetic difference from the tag approach.
- **Bespoke hardcoded Events layout** — rejected outright; breaks the project's core principle that all page content flows through `site.json` + generic renderers with zero page-specific render logic.

## Data model changes (`src/renderPage.ts`)

1. `CardsBlock` item type gains one optional field:
   ```ts
   type CardsBlock = { type: 'cards'; items: { title: string; body: string; tag?: string }[] }
   ```
   When `tag` is present, it renders as a small uppercase mono label above the title (same visual treatment as the hero's tier list: `border-b border-[var(--color-muted)]/40`, `font-brand text-xs uppercase tracking-wide`). When absent, the card renders exactly as it does today — fully backward compatible with Blog/Gallery/Shop's existing untagged cards.

2. New block type:
   ```ts
   type HeadingBlock = { type: 'heading'; text: string }
   type Block = TextBlock | ListBlock | CardsBlock | CtaBlock | HeadingBlock
   ```
   Renders as `<h2 class="font-brand text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">${text}</h2>` — the same mono/uppercase vocabulary already used for nav links, tier list, and card tags. Participates in `renderPage`'s existing block ordering and `space-y-8` spacing; excluded from the `cta` extraction filter (only `type === 'cta'` is special-cased) so it flows through the general body-blocks path unchanged.

3. Cards grid fix: `grid gap-4 sm:grid-cols-2` → `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. A 3-item cards block now fills a clean row on desktop instead of 2-over-1; a 1-item block occupies the first column without stretching to fill the row (fixed `grid-cols-3` doesn't stretch a lone child). This is shared code, so Shop/Gallery/Blog's existing 3-item card grids also shift from 2-over-1 to 3-across as a side effect — their content is not otherwise touched by this spec.

## Content (`content/site.json` → `pages.events`)

```json
{
  "title": "Events",
  "intro": "No paid workshops, no ticket prices — just regular reasons to show up in person.",
  "blocks": [
    { "type": "cards", "items": [
      { "tag": "DROP IN", "title": "Casual meetups", "body": "Coffee, conversation, no agenda." },
      { "tag": "SHOW & TELL", "title": "Show-and-tell sessions", "body": "Bring something you built. Five minutes, no judgment." },
      { "tag": "COWORK", "title": "Coworking sessions", "body": "Bring your laptop, work alongside people, ask for help when stuck." }
    ]},
    { "type": "heading", "text": "Where" },
    { "type": "cards", "items": [
      { "title": "Metro Manila", "body": "Real dates will show here once our Luma calendar is live. For now, watch WhatsApp for the next one." }
    ]},
    { "type": "cta", "label": "Join WhatsApp for dates", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
  ]
}
```

No new claims or dates are invented — the three format descriptions restate the content already established in the prior nav-multipage spec, and the Metro Manila entry states the honest current status rather than fabricating a schedule or embed.

## Data flow

Unchanged from the existing architecture: `src/pages/events.ts` → `renderPage(site.pages.events)` → `renderBlock` per block, `cta` blocks pulled into their own trailing section. No new page-specific render logic; the two new blocks (tagged cards, heading) are handled entirely by the existing generic switch in `renderPage.ts`.

## Error handling

Unchanged — `renderPage.ts`'s existing "content coming soon" fallback for missing page data already covers this page like every other. No new failure modes introduced (no network calls, no external embeds yet).

## Testing

- `tests/renderPage.test.ts`:
  - a cards item's `tag` renders when present
  - a cards item with no `tag` renders with no tag markup (regression guard for backward compatibility)
  - the cards grid wrapper includes `lg:grid-cols-3`
  - a `heading` block renders its text
- `tests/content.test.ts`: existing shape checks (non-empty title/intro/blocks) already cover the updated Events content without changes.
- `scripts/qc-nav.mjs`: no changes needed — still pure static rendering, no new console/network surface.
- Manual check after implementation: view the built Events page to confirm the 3-card row, "Where" label, single Metro Manila card, and CTA band read well together at both desktop and mobile viewports (no new automated visual-regression tooling exists in this repo).

## Out of scope

- Any real Luma embed/iframe or API integration — deferred to its own future spec once a real Luma Plus calendar exists (see investigation above).
- Real dates, schedule, or calendar UI of any kind.
- Any other page's content (Shop/Gallery/Blog only change visually, via the shared grid-cols fix — their `site.json` content is untouched).
- New icons or image assets — the tag treatment reuses existing typographic/mono styling, no new artwork.
- Changes to the header band or CTA band structure in `renderPage.ts` — only the content band's block types change.
