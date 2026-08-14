# Member-Gated Pages + Account Page Rework — Design

## Goal

Learn, Resources, and Forum become member-only content, enforced server-side (not just hidden with
JS). The Account page is reworked so login/signup is the first thing a visitor sees, not something
buried below a role-ladder list.

## Context

The auth backend (Express + Postgres, session-based, WhatsApp-roster-gated signup) already exists
and is merged (`server/`, `src/accountAuth.ts`, `src/pages/account.ts`). This spec covers the next
increment: using that backend to actually gate content, and improving where login sits on the page.

**Already satisfied, no new work needed:** "before they can even sign up, they need to provide a
WhatsApp number" is already enforced today — signup requires `whatsappNumber` and fails unless the
normalized number is pre-approved in the `roster` table (roster entries are added by an admin via
`/admin`, sourced from the WhatsApp group roster). Nothing in this spec touches that.

## Decisions made during brainstorming

- **Gating strength:** server-side block. Express intercepts requests for the three gated pages and
  only serves the real HTML to an authenticated session. Anonymous requests never receive the
  content (verified this matters — the current build is a client-rendered SPA-per-page bundle, so
  the built `.html` files are thin shells; the actual page content lives in the JS chunk, which is
  what makes a purely-cosmetic client-side hide meaningfully weaker than blocking the route).
- **Forum scope:** gated too, even though its only content today is a WhatsApp join link. The public
  join link stays reachable elsewhere (Account page's "Join via WhatsApp" CTA, which remains
  ungated) so newcomers can still find their way in. Forum becomes a members' landing page ready for
  future forum-style content.
- **Gated-page UX:** redirect. `GET /learn.html` (etc.) while logged out → `302` to
  `/account.html?next=/learn.html`. After a successful login or signup, the page redirects the
  browser to `next` if present.
- **Nav visibility:** Learn/Resources/Forum stay visible in the nav for everyone, marked with a small
  lock indicator. The nav's shape never changes based on auth state; clicking through while logged
  out is what triggers the redirect.
- **Account page layout:** login/signup panel goes directly below the title/intro, above the
  role-ladder content and the "Join via WhatsApp" CTA. Single column, matches the site's existing
  panel/CTA visual language — no new two-column layout pattern.

## Architecture

**Gating happens at the route layer, above static serving.** `server/index.ts` already runs
`express.static(distDir)` behind everything else. Three explicit routes for `/learn.html`,
`/resources.html`, `/forum.html` are added above it, each guarded by a new `requireMember`
middleware. A request that passes the guard falls through to `res.sendFile` for that specific page;
a request that fails is redirected. No page ever reaches `express.static`'s fallback, and no
JavaScript needs to run for the block to take effect.

```
GET /learn.html
  → requireMember (checks req.session.userId)
      logged in  → res.sendFile(dist/learn.html)
      logged out → res.redirect('/account.html?next=/learn.html')
```

**Note on the base-path change already shipped:** `server/index.ts` now resolves routes under an
optional `BASE_PATH` prefix (empty by default). The three new gated routes and their redirects must
be written relative to that same mount point (i.e. registered on the shared `router`, and redirect
targets built as relative paths like `/account.html?next=...` rather than absolute paths), so gating
behaves identically whether the app is mounted at `/` (production, local dev) or `/sig-espresso`
(tunnel preview).

**Both `member` and `admin` roles pass the gate.** Admin is a superset of member access; there's no
scenario where an admin should be blocked from content a regular member can see.

## Components

1. **`server/auth/requireMember.ts`** (new) — mirrors the existing `requireAdmin.ts` pattern but
   redirects instead of returning JSON, since these are page routes, not API routes:
   ```ts
   import type { Request, Response, NextFunction } from 'express'

   export function requireMember(req: Request, res: Response, next: NextFunction) {
     if (!req.session.userId) {
       const next_ = encodeURIComponent(req.originalUrl.split('?')[0])
       return res.redirect(`/account.html?next=${next_}`)
     }
     return next()
   }
   ```
   Uses `req.originalUrl` so the redirect target is correct whether the app is mounted at `/` or
   under `BASE_PATH` (Express strips the mount prefix from `req.path` inside a sub-router, but
   `req.originalUrl` retains it).

2. **`server/index.ts`** — three new routes registered on the existing `router` (same one already
   scoped by `BASE_PATH`), positioned before `router.use(express.static(distDir))`:
   ```ts
   for (const page of ['learn', 'resources', 'forum']) {
     router.get(`/${page}.html`, requireMember, (_req, res) => {
       res.sendFile(path.join(distDir, `${page}.html`))
     })
   }
   ```

3. **`src/renderPage.ts`** — `renderPage()` gains an optional second parameter:
   ```ts
   export function renderPage(page: PageData | undefined, opts?: { afterHero?: string }): string
   ```
   The returned HTML gets `opts?.afterHero ?? ''` spliced in between the closing `</section>` of the
   hero band and the opening `<section>` of the content band. When `opts` is omitted (all 10 other
   pages), output is byte-identical to today.

4. **`src/pages/account.ts`** — changes from:
   ```ts
   ${renderPage((site.pages as any).account)}
   ${renderAuthSection()}
   ```
   to:
   ```ts
   ${renderPage((site.pages as any).account, { afterHero: renderAuthSection() })}
   ```

5. **`src/accountAuth.ts`** — three changes:
   - Restyle the auth section as a highlighted panel: wrap the forms container in the same
     panel/border/radius treatment used elsewhere on the site (`border border-[var(--color-fg)]/15
     bg-[var(--color-panel)] rounded-[var(--radius-brand)] p-6`), full content width instead of the
     current `max-w-md` narrow column.
   - Read `?next=` from `location.search` on load. If present, render a banner above the forms:
     `Sign in to view {PageName}`, where `{PageName}` is derived by taking the path's filename
     (strip leading `/`, strip `.html`) and capitalizing the first letter — e.g. `/learn.html` →
     `Learn`. No new dependency, no coupling to `content/site.json`'s nav list.
   - After a successful login or signup (`res.ok`), if `next` is present, redirect the browser there
     (`window.location.href = next`) instead of calling `refresh()` in place. Both signup and login
     already establish a session today, so both need this.

6. **`content/site.json`** — add `"membersOnly": true` to the Learn, Resources, and Forum entries in
   `nav.items`. No other pages get this flag.

7. **`src/chrome.ts`** — `renderNavLinks` appends a small lock glyph after the label when
   `item.membersOnly` is true:
   ```ts
   const lock = item.membersOnly
     ? ' <span aria-hidden="true" class="text-[10px] opacity-60">&#128274;</span>'
     : ''
   ```
   `NavItem` type gains an optional `membersOnly?: boolean` field. No session check runs client-side
   — the lock always renders regardless of auth state; the server-side redirect is what actually
   enforces the gate on click-through.

## Data flow / error handling

- **Unauthenticated `GET /learn.html`** → `302` → `/account.html?next=%2Flearn.html` → account page
  loads, banner reads "Sign in to view Learn" → user logs in → JS reads `next`, sets
  `window.location.href` → browser re-requests `/learn.html`, now with a valid session cookie →
  `requireMember` passes → real content served.
- **Authenticated `GET /learn.html`** → served directly, no redirect round trip.
- **Direct `curl`/scraping without a session cookie** → gets only a `302` and a `Location` header,
  no page content, no JS chunk reference — satisfies the "real enforcement" requirement from
  brainstorming.
- **Session expiry** (30-day sliding TTL, already implemented) → next visit to a gated page behaves
  identically to a fresh anonymous visit. No special handling needed.
- **Non-gated pages** (Events, Shop, Blog, Gallery, About, Contribute, Account, home) are completely
  unaffected — they're never touched by `requireMember` and continue to be served directly by
  `express.static`.

## Known limitation

Gating only takes effect when pages are served through Express — `npm run build && npm run server`
(or the tunnel/production equivalents). `npm run dev` (Vite's dev server) serves `.html` files
directly from source and does not route through `server/index.ts`, so gating will not be enforced
in `npm run dev`. This is the same boundary that already exists for the `/api` proxy in
`vite.config.ts`. Verification of gating behavior happens via the built+served path, not `npm run
dev`.

## Testing

- **`tests/server/pageGating.test.ts`** (new, supertest):
  - `GET /learn.html`, `/resources.html`, `/forum.html` unauthenticated → `302` with
    `Location: /account.html?next=%2F<page>.html`.
  - Same three routes with an authenticated session cookie (sign up or log in first via the
    existing auth routes in the test) → `200`, body matches the real built file's content.
  - Regression guard: `GET /events.html` unauthenticated → still `200` (confirms gating didn't leak
    onto non-gated static routes).
- **`tests/accountAuth.test.ts`** (extend): assert the panel wrapper classes are present; assert
  that when `renderAuthSection()`'s markup is inspected, the `next`-banner element exists in the DOM
  structure (exact behavior of populating/hiding it is runtime logic covered by the redirect-after-
  login change, which is exercised indirectly by the new supertest gating tests hitting the real
  auth routes).
- **`scripts/qc-nav.mjs`** — currently click-throughs all 11 pages anonymously and asserts no
  console/HTTP errors. Once gating ships, anonymous requests to Learn/Resources/Forum will 302 by
  design — the script needs a follow-up update (log in once at the start of the run, or special-case
  those three URLs to expect a redirect rather than a 200) so it doesn't start reporting false
  failures. This is called out here as a required task in the implementation plan, not deferred
  silently.

## Out of scope

- Any change to what content Learn/Resources/Forum actually contain (still placeholder copy).
- Role-based access beyond member vs. admin (e.g. gating some pages to `VETERAN`+ only) — the site's
  role ladder today is cosmetic copy, not an enforced permission level.
- Hiding the nav entirely for logged-out visitors (explicitly rejected in favor of the lock-icon
  approach).
