# Account Page — Membership Card Redesign

## Goal

Replace the current Account page login/signup panel and member dashboard (a bordered form panel
that hands off to an unrelated-looking card grid after login) with **one persistent "membership
card" element** that plays both roles — signup/login before you're in, Learn/Resources/Forum after.
Fixes the four complaints from the previous version: flat visual style, awkward layout, weak brand
integration, and forms feeling stapled to the dashboard.

## Context

This supersedes the visual/layout portion of
`docs/superpowers/specs/2026-08-15-account-dashboard-design.md` (that spec's nav-simplification and
`dashboard.sections` data model already shipped and are unchanged — only the Account page's own UI
is being redone). Explored via a full visual-companion brainstorming session: three layout
directions (a unified card, a two-pane console, an editorial corkboard) were wireframed; the card
direction was chosen because it's the only one that makes signup/login and the dashboard the same
object instead of two adjacent ones. Two visual styles (playful "coffee stamps" vs. restrained
"minimal ticket") were then wireframed and merged into a hybrid, approved as-is.

## Decisions made during brainstorming

- **Layout:** one card, always present in the same spot (directly below the hero, in the existing
  `afterHero` slot). Its contents change by state; its outer shape does not.
- **Visual style:** ticket-styled card — thin border, two small semicircular "notches" cut into the
  left/right edges at vertical center (like a real ticket stub), monospace label line at the top.
- **Tier stamps:** a row of 5 circles (reusing `content/site.json`'s existing `hero.tiers` array —
  NEWCOMER/BUILDER/MENTOR/VETERAN/LEGEND — not a new data list) is a **static illustration of the
  ladder concept**, identical in every state. It is NOT a personal progress indicator — the backend
  has no per-user tier field, so nothing here claims to show "your" position, only "the" ladder.
  This replaces the old explanatory paragraph + bulleted tier list entirely.
- **What changes between states:** only the header line above the stamps, the tab row, and the tab
  content below it.
  - Not logged in: header reads "MEMBERSHIP CARD"; tabs are **Sign up** / **Log in**; a "Join via
    WhatsApp" link sits below the form.
  - Logged in: header reads "Welcome back, {name}" (real session data); tabs are **Learn** /
    **Resources** / **Forum** (from `dashboard.sections`); a Log out control replaces the WhatsApp
    link (redundant once logged in — signup already requires being in the WhatsApp group).
- **`content/site.json`'s `pages.account.blocks` becomes empty** — the old role-ladder text/list and
  the WhatsApp CTA block both move into the card (as the static stamp illustration and the guest-tab
  WhatsApp link, respectively) and are removed from the generic page-body content.

## Simplifications made from the exploratory mockups (flagging explicitly, not silently dropping)

The mockups used during brainstorming were rough wireframes, not final assets. Two intentional
simplifications for implementation:
1. **Stamps are plain filled/outlined circles**, not per-stamp coffee-cup icons. A hand-drawn icon
   per stamp is a lot of new SVG authoring for a purely decorative element; plain circles still read
   as a stamp/punch-card track.
2. **No mascot cutout badge on the card itself.** The mockup showed a small circular "peeking
   mascot" badge. The site's actual mascot art (`public/images/hero-bg.svg`, the "Nova & Circle"
   illustration) is a full hand-drawn scene, not a reusable cropped asset, and cropping a
   convincing "peek" from it reliably needs visual iteration this design pass doesn't have time for.
   The hero band directly above the card already shows that illustration prominently — the card
   doesn't need its own copy to feel connected to it. If a bespoke card-mascot asset is wanted
   later, that's a separate, standalone piece of work (new artwork), not a code change.

## Architecture

**One card, three internal states, reusing the existing state machine.** The card's outer shell
(border, notches, label line, stamp row) renders unconditionally. Inside it, exactly one of three
regions is visible at a time — loading / guest / member — using the same show/hide pattern the
current `accountAuth.ts` already uses for its two states, just applied to three regions instead of
two, and with the guest and member regions each containing their own internal tab switcher.

**Tab switching is one small reusable function, used twice.** Both tab groups (Sign up/Log in, and
Learn/Resources/Forum) behave identically — click a tab, show its panel, hide the others, restyle
the active tab. A single `wireTabGroup(root: HTMLElement)` helper (scoped to whichever container it's
given) is called once for the guest region and once for the member region, rather than writing the
click-handling logic twice.

**No backend/API changes.** Same three endpoints as before (`/api/auth/me`, `/signup`, `/login`,
`/logout`), same session-based auth. This is a frontend-only redesign.

## Components

1. **`src/accountAuth.ts`** — full rewrite of the render/mount functions (same exported names and
   signatures as today: `renderAuthSection(dashboardSections)`, `mountAuthSection(dashboardSections)`,
   `DashboardSection` type — no change to how `src/pages/account.ts` calls them). Internally:
   - Renders the card shell (border + notches via a couple of small absolutely-positioned elements,
     not a new CSS file — matches the codebase's existing "Tailwind classes only, no `style=`
     attributes, no new stylesheets" convention) with the stamp row built from `site.hero.tiers`
     (a new parameter — `renderAuthSection` needs read access to the tiers list, either passed in
     alongside `dashboardSections` or imported the same way `site.json` is imported elsewhere).
   - Renders the loading / guest / member regions, each hidden except the one matching current state.
   - Guest region: Sign up/Log in tabs, the two existing forms (unchanged field set: name/whatsapp/
     password for signup, identifier/password for login; password show/hide toggle carries over
     unchanged from the current implementation, including its per-field `aria-label`), WhatsApp link.
   - Member region: greeting line, Learn/Resources/Forum tabs, each tab's panel rendered via the
     existing `renderBlocks()` from `renderPage.ts` (unchanged — already the right reuse), Log out
     button.
   - `mountAuthSection` wires: the existing `/api/auth/me` refresh logic (now also swapping the
     header label between "MEMBERSHIP CARD" and "Welcome back, {name}"), the existing signup/login/
     logout handlers (unchanged behavior), the password-toggle handler (unchanged), and two calls to
     the new `wireTabGroup()` helper.

2. **`src/pages/account.ts`** — likely unchanged, since the exported function signatures from
   `accountAuth.ts` aren't changing. Only touched if `renderAuthSection` ends up needing
   `site.hero.tiers` passed as an explicit argument rather than importing `site.json` directly
   (matching the existing "pass data in, don't import site.json inside accountAuth.ts" pattern from
   the last redesign) — to be settled during planning, not a design-level decision.

3. **`content/site.json`** — `pages.account.blocks` becomes `[]`. `dashboard.sections` and
   `hero.tiers` are both reused as-is, unchanged.

4. **`src/renderPage.ts`** — small addition: when `page.blocks` is empty, skip rendering the content
   `<section>` entirely (today it would render an empty, padded, visually-dead section). No other
   change — the hero band, `afterHero` slot, and cta band logic are untouched. (No page other than
   Account will have empty blocks after this change, so this is a safe, narrowly-triggered addition.)

## Data flow / error handling

- **Unauthenticated `GET` of the page:** loading region shows briefly, `/api/auth/me` returns 401,
  guest region shows (Sign up tab active by default).
- **Authenticated:** loading region shows briefly, `/api/auth/me` returns 200, member region shows
  (Learn tab active by default), header label becomes "Welcome back, {name}".
  Sign up / log in / log out behavior (requests, error display, session handling) is entirely
  unchanged from the current implementation — only where that UI lives on the page changes.
- **Stamp row and card shell never change based on auth state or API responses** — they are static
  markup, not fetched or computed from session data. This is deliberate (see "Decisions" above) and
  should not be "improved" later to show real progress without a corresponding backend change to
  actually track per-user tier.

## Testing

- `tests/accountAuth.test.ts` gets rewritten for the new structure: assert the card shell renders
  (notch elements, label line, 5 stamps from a sample `tiers` list), assert guest region has both
  tabs with correct `data-tab` values and both forms present, assert member region has all 3
  dashboard section titles as tabs with `renderBlocks()` output present for each, assert the
  password-toggle `aria-label` behavior carries over (same assertions as before, adapted to new
  markup), and add a check that clicking a `.account-tab` button (via a lightweight jsdom-free
  simulation, or by asserting the click handler wiring exists) toggles the right panel — exact test
  approach (given this repo's tests run in a DOM-less `node` environment per its Vitest config) to be
  finalized during planning, since it may need string-based assertions on the rendered HTML plus a
  narrower unit test of the extracted `wireTabGroup` logic rather than a full simulated click.
- `tests/content.test.ts` update: assert `pages.account.blocks` is `[]` (currently asserts every
  page has at least one block — Account becomes an explicit, documented exception).
- Manual verification against the live tunnel (screenshot), same as every other frontend change this
  session — confirm both guest and logged-in states, both tab groups, mobile width.

## Out of scope

- Any backend change (still frontend-only).
- A real per-user tier/progress field — explicitly rejected per the "Simplifications" section.
- A bespoke mascot-cutout asset for the card — flagged as separate future work if wanted.
- Redesigning any other page.
