# Account Dashboard + Nav Simplification — Design

> **PARTIALLY SUPERSEDED (2026-08-15):** the nav-simplification and data-model parts of this spec
> (Learn/Resources/Forum removed from nav, content moved into `dashboard.sections`) were implemented
> and stay as-is. The visual/layout design for the Account page itself — the "membership card" panel
> described below — was shipped, then judged not good enough and redesigned from scratch via a full
> brainstorming pass. See `docs/superpowers/specs/2026-08-15-account-membership-card-design.md` for
> the current design of the login/signup/dashboard UI.

## Goal

Remove Learn, Resources, and Forum as standalone nav pages. Their content moves into a members-only
dashboard on the Account page. The Account page's login/signup panel — currently buried below the
role-ladder content and styled with bare unstyled inputs — gets a real visual redesign.

## Context

This supersedes `docs/superpowers/specs/2026-08-14-member-gated-pages-design.md` (never
implemented), which planned server-side route gating for those three pages as separate URLs. The
user decided against maintaining them as separate gated routes and wants their content consolidated
into the Account page instead.

Confirmed via live screenshot of the current site: the auth panel sits at the very bottom of the
page, below the role-ladder list and the "Join via WhatsApp" CTA, styled as plain bordered `<input>`
boxes in a narrow left-aligned column with a large empty gap to its right. There is no dashboard of
any kind today — `/api/auth/me` succeeding just swaps a one-line "Logged in as {name}. [Log out]"
box in place of the forms.

Research on login/dashboard UX (see chat) confirmed the existing form shape is already sound
(single-column, minimal fields, no confirm-password) — the fix here is visual design and
information architecture, not field-level rework. One concrete addition worth making: a
show/hide toggle on password fields (cited as reducing failed-signup friction).

## Decisions made during brainstorming

- **Old pages:** deleted outright, not just unlinked. `learn.html`, `resources.html`, `forum.html`,
  their `src/pages/*.ts` files, and their entries in `vite.config.ts` / `scripts/qc-nav.mjs` are all
  removed. Their content becomes the single source of truth for the dashboard — no duplicate copy.
- **Aesthetic direction:** lean into the brand's existing loyalty-ladder framing (NEWCOMER → LEGEND
  already reads like a coffee-shop punch card) rather than importing generic SaaS-dashboard chrome.
  The login/signup panel becomes a bordered "membership card" styled panel using the site's existing
  tokens (`--color-panel`, `--color-accent`, `font-brand` for labels) — no new dependencies, no new
  colors.
- **What the dashboard actually shows:** the backend has no per-user tier field — the NEWCOMER/
  BUILDER/.../LEGEND ladder is cosmetic marketing copy today, not stored per account. The dashboard
  will greet the member by name and role (`member`/`admin`, from the session — the only per-user
  data that actually exists), not fabricate a tier that isn't tracked. It will NOT invent activity
  feeds, stats, or other data the backend doesn't have.
- **The role-ladder + "Join via WhatsApp" content stays visible regardless of login state.** It's
  kept simple: rather than restructuring how `renderPage()` renders the account page's body/CTA
  bands based on auth state (extra complexity for little benefit), that content just stays where it
  is and is harmless to show a logged-in member too. Only the login-panel-vs-dashboard region toggles.

## Architecture

**Page structure (both logged-in and logged-out), using the `afterHero` slot already added to
`renderPage()`:**

```
hero band (title + intro)                         <- unchanged
  |
[toggle region: loading / guest panel / dashboard]  <- afterHero slot, JS-toggled by session state
  |
role-ladder text + list (existing content block)    <- unchanged, always visible
  |
"Join via WhatsApp" CTA (existing cta block)         <- unchanged, always visible
```

**Content data model.** A new top-level `dashboard` key in `content/site.json`:
```json
"dashboard": {
  "sections": [
    { "key": "learn", "title": "Learn", "blocks": [ /* same Block[] shape as page blocks */ ] },
    { "key": "resources", "title": "Resources", "blocks": [ ... ] },
    { "key": "forum", "title": "Forum", "blocks": [ ... ] }
  ]
}
```
populated by moving the existing `pages.learn.blocks` / `pages.resources.blocks` / `pages.forum.blocks`
content over verbatim (same copy, just relocated), then removing the old `pages.learn` /
`pages.resources` / `pages.forum` entries and their `nav.items` rows entirely.

**Rendering reuse.** `src/renderPage.ts` already has a block-rendering switch (`renderBlock`) used
internally. It gains one export:
```ts
export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('')
}
```
so the dashboard can render each section's `text`/`list`/`cards`/`cta` blocks with the exact same
logic as every other page, instead of duplicating a switch statement.

## Components

1. **`content/site.json`** — remove Learn/Resources/Forum from `nav.items` (10 → 7 items) and from
   `pages`; add the new `dashboard.sections` array as described above.

2. **`src/renderPage.ts`** — export `renderBlocks()` as shown above. No other changes; `renderPage()`
   itself is untouched.

3. **`src/accountAuth.ts`** — the file already owns the loading/logged-out/logged-in toggle; this is
   extended, not replaced:
   - `renderAuthSection(dashboardSections: DashboardSection[]): string` and
     `mountAuthSection(dashboardSections: DashboardSection[]): void` both take the dashboard section
     data as an explicit parameter (matching how `renderHeader(site, ...)` and `renderPage(page)`
     already take their data as parameters rather than importing `site.json` directly).
   - `DashboardSection = { key: string; title: string; blocks: Block[] }`, imported from
     `./renderPage`.
   - **Guest state** (`#account-auth-forms`): restyled as a bordered membership-card panel —
     `border border-[var(--color-fg)]/15 bg-[var(--color-panel)] rounded-[var(--radius-brand)] p-6`,
     full content width (replacing the current narrow `max-w-md` column). Both password fields get a
     show/hide toggle button (a small text button, `type` attribute flipped between `password` and
     `text` on click — plain DOM manipulation, no new dependency).
   - **Logged-in state** (`#account-auth-loggedin`) becomes the dashboard: a greeting line ("Welcome
     back, {name}"), then one card per dashboard section (title + `renderBlocks(section.blocks)`,
     each wrapped in the same panel styling as the guest card for visual consistency), then the
     existing Log out button (relocated here, same handler as today — no behavior change, just
     moved out of the old one-line box).
   - `refresh()`'s existing logic (fetch `/api/auth/me`, toggle visibility, set `nameEl.textContent`)
     is unchanged in shape — it already toggles between the two container divs; those two containers
     just have richer content now.

4. **`src/pages/account.ts`** — passes `(site.dashboard as any).sections` into both
   `renderAuthSection()` and `mountAuthSection()`.

5. **Deletions:** `learn.html`, `resources.html`, `forum.html` (repo root); `src/pages/learn.ts`,
   `src/pages/resources.ts`, `src/pages/forum.ts`.

6. **`vite.config.ts`** — remove `'resources'`, `'forum'`, `'learn'` from the `pageSlugs` array (10
   entries → 7; `index.html`'s `main` entry is separate and unaffected).

7. **`scripts/qc-nav.mjs`** — remove `'resources.html'`, `'forum.html'`, `'learn.html'` from
   `PAGE_PATHS` (11 pages → 8, including the `''` home entry).

## Data flow / error handling

- **Logged out:** `/api/auth/me` → 401 → guest panel shown (membership-card login/signup), dashboard
  hidden. Unchanged from today's control flow, just different markup.
- **Logged in:** `/api/auth/me` → 200 → dashboard shown (greeting + 3 section cards + log out),
  guest panel hidden. Section content is entirely static (from `content/site.json`, bundled at build
  time) — no new API calls are introduced by this change.
- **Log out:** unchanged — `POST /api/auth/logout` then `refresh()`, which flips back to the guest
  panel.
- No server-side changes at all in this pass — this is a frontend-only restructuring. The
  `requireMember`/route-gating work from the superseded spec is not built.

## Testing

- **`tests/content.test.ts`** — update `PAGE_SLUGS` to the remaining 7 page slugs; add a new check
  that `site.dashboard.sections` has exactly 3 entries, each with a non-empty `title` and at least
  one block (mirroring the existing per-page shape check).
- **`tests/accountAuth.test.ts`** — extend for the new signature (`renderAuthSection(sections)`):
  assert the membership-card panel classes are present; assert each dashboard section's title
  appears in the logged-in-state markup; assert a password-visibility-toggle control exists per
  password field.
- **`scripts/qc-nav.mjs`** — the file itself is edited (Component 7 above) as part of this change,
  not left broken; verify with a live `npm run qc` pass after implementation, same as any other
  change per the project's existing conventions.
- Delete `tests/` coverage that specifically targeted the removed pages, if any exist (checked: none
  do — the only cross-page test is `content.test.ts`, updated above).

## Out of scope

- Any per-user tier/activity data — the backend doesn't track it and this spec doesn't add it.
- Server-side route gating (superseded, see Context).
- Redesigning the hero band, footer player, or any other page — this pass touches only the Account
  page and nav.
