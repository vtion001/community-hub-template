# Account Dashboard + Nav Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Learn/Resources/Forum from the nav and delete them as standalone pages; fold their
content into a members-only dashboard rendered inside the Account page, and redesign the Account
page's login/signup panel.

**Architecture:** Content-only data migration in `content/site.json` (3 nav items + 3 page entries
removed, one new `dashboard.sections` array added) feeds a restyled `src/accountAuth.ts`, which now
renders two real states instead of a placeholder: a bordered "membership card" guest panel
(signup/login, with password show/hide) and a logged-in dashboard (greeting + one card per section,
reusing the site's existing block-rendering logic). No backend/server changes.

**Tech Stack:** Vite + vanilla TypeScript, Tailwind v4 (CSS custom properties), Vitest.

## Global Constraints

- Frontend-only change — no modifications to `server/` in this plan.
- No new dependencies. The password show/hide toggle is plain DOM manipulation.
- Reuse the existing block-rendering logic (`text`/`list`/`cards`/`cta`) for dashboard section
  content — do not duplicate that switch statement.
- The dashboard shows the member's name and role (`member`/`admin`, from the session) only. Do not
  fabricate tier badges, activity feeds, or any other data the backend doesn't track.
- The role-ladder text/list and "Join via WhatsApp" CTA already on the Account page stay visible
  regardless of login state — this plan does not touch that content or its rendering.
- Old pages (`learn.html`, `resources.html`, `forum.html`) are deleted outright, not left on disk —
  along with their `src/pages/*.ts` files and their entries in `vite.config.ts` and
  `scripts/qc-nav.mjs`.
- All existing Tailwind arbitrary-value tokens (`--color-panel`, `--color-fg`, `--color-accent`,
  `--radius-brand`, `font-brand`) — no new colors, no inline `style={{}}`, no new styling paradigm.

---

## Task 1: Migrate content data — remove 3 nav/page entries, add dashboard sections

**Files:**
- Modify: `content/site.json`
- Modify: `src/renderPage.ts`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces: `content/site.json`'s `dashboard.sections: Array<{ key: string; title: string; blocks: Block[] }>`
  (3 entries: `learn`, `resources`, `forum`, in that order) — consumed by Task 3.
- Produces: `export function renderBlocks(blocks: Block[]): string` from `src/renderPage.ts` —
  consumed by Task 3.
- Produces: `renderPage(page: PageData | undefined, opts?: { afterHero?: string }): string` (updated
  signature, second parameter is new) — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Replace `tests/content.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest'
import site from '../content/site.json'

const PAGE_SLUGS = [
  'events', 'shop', 'blog',
  'gallery', 'about', 'contribute', 'account',
]

const DASHBOARD_SECTION_KEYS = ['learn', 'resources', 'forum']

describe('site.json content shape', () => {
  it('has a pages entry for every nav item slug', () => {
    for (const slug of PAGE_SLUGS) {
      expect(site.nav.items.some((i: any) => i.slug === slug)).toBe(true)
      expect((site.pages as Record<string, unknown>)[slug]).toBeDefined()
    }
  })

  it('every nav item href points to a real .html file', () => {
    for (const item of site.nav.items as any[]) {
      expect(item.href).toMatch(/^\/[a-z]+\.html$/)
    }
  })

  it('every page has a non-empty title, intro, and at least one block', () => {
    for (const slug of PAGE_SLUGS) {
      const page = (site.pages as Record<string, { title: string; intro: string; blocks: unknown[] }>)[slug]
      expect(page.title.length).toBeGreaterThan(0)
      expect(page.intro.length).toBeGreaterThan(0)
      expect(page.blocks.length).toBeGreaterThan(0)
    }
  })

  it('nav has exactly 7 items, with Learn/Resources/Forum removed', () => {
    expect(site.nav.items.length).toBe(7)
    for (const removedSlug of DASHBOARD_SECTION_KEYS) {
      expect(site.nav.items.some((i: any) => i.slug === removedSlug)).toBe(false)
    }
  })

  it('has exactly 3 dashboard sections, one per removed page, each with a title and at least one block', () => {
    const sections = (site as any).dashboard.sections
    expect(sections.length).toBe(3)
    for (const key of DASHBOARD_SECTION_KEYS) {
      const section = sections.find((s: any) => s.key === key)
      expect(section).toBeDefined()
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.blocks.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/content.test.ts`
Expected: FAIL — nav still has 10 items and `site.dashboard` is undefined.

- [ ] **Step 3: Remove Resources/Forum/Learn from `nav.items`**

In `content/site.json`, replace:

```json
    "items": [
      { "label": "Events", "href": "/events.html", "slug": "events" },
      { "label": "Shop", "href": "/shop.html", "slug": "shop" },
      { "label": "Resources", "href": "/resources.html", "slug": "resources" },
      { "label": "Forum", "href": "/forum.html", "slug": "forum" },
      { "label": "Blog", "href": "/blog.html", "slug": "blog" },
      { "label": "Gallery", "href": "/gallery.html", "slug": "gallery" },
      { "label": "Learn", "href": "/learn.html", "slug": "learn" },
      { "label": "About", "href": "/about.html", "slug": "about" },
      { "label": "Contribute", "href": "/contribute.html", "slug": "contribute" },
      { "label": "Account", "href": "/account.html", "slug": "account" }
    ],
```

with:

```json
    "items": [
      { "label": "Events", "href": "/events.html", "slug": "events" },
      { "label": "Shop", "href": "/shop.html", "slug": "shop" },
      { "label": "Blog", "href": "/blog.html", "slug": "blog" },
      { "label": "Gallery", "href": "/gallery.html", "slug": "gallery" },
      { "label": "About", "href": "/about.html", "slug": "about" },
      { "label": "Contribute", "href": "/contribute.html", "slug": "contribute" },
      { "label": "Account", "href": "/account.html", "slug": "account" }
    ],
```

- [ ] **Step 4: Remove the `resources` and `forum` page entries**

Replace:

```json
    "resources": {
      "title": "Resources",
      "intro": "Things members keep coming back to — added as we find them, not sold to you.",
      "blocks": [
        { "type": "list", "items": [
          "Tools — AI and dev tools the community actually uses.",
          "Gear guides — coffee setups worth the counter space.",
          "Reads — articles and threads worth the ten minutes."
        ]}
      ]
    },
    "forum": {
      "title": "Forum",
      "intro": "There's no separate forum software — the WhatsApp group is the forum.",
      "blocks": [
        { "type": "text", "body": "Questions, project updates, and random tangents all happen in one place. No sub-channels to lose track of, no notifications from six different apps." },
        { "type": "cta", "label": "Join the conversation", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    },
    "blog": {
```

with:

```json
    "blog": {
```

- [ ] **Step 5: Remove the `learn` page entry**

Replace:

```json
    "learn": {
      "title": "Learn",
      "intro": "Low-pressure ways to pick things up from other members.",
      "blocks": [
        { "type": "list", "items": [
          "Intro nights — beginner-friendly walkthroughs of AI tools.",
          "Workshops — hands-on, small group, bring a laptop.",
          "Pairing sessions — sit with someone and work through a real problem."
        ]}
      ]
    },
    "about": {
```

with:

```json
    "about": {
```

- [ ] **Step 6: Add the `dashboard` top-level key**

The `"pages"` object is currently the last key in the file, ending with:

```json
    "account": {
      "title": "Account",
      "intro": "Sign in below, or create an account if you're already in the WhatsApp group.",
      "blocks": [
        { "type": "text", "body": "Everyone starts as a Newcomer and moves up by showing up — no application, no approval process." },
        { "type": "list", "items": [
          "NEWCOMER — just joined.",
          "BUILDER — regular at meetups, sharing what you're working on.",
          "MENTOR — helping newer members.",
          "VETERAN — long-time regular.",
          "LEGEND — community fixture."
        ]},
        { "type": "cta", "label": "Join via WhatsApp", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    }
  }
}
```

Replace the final `  }\n}` (closing `pages`, then the root object) with:

```json
    }
  },
  "dashboard": {
    "sections": [
      {
        "key": "learn",
        "title": "Learn",
        "blocks": [
          { "type": "list", "items": [
            "Intro nights — beginner-friendly walkthroughs of AI tools.",
            "Workshops — hands-on, small group, bring a laptop.",
            "Pairing sessions — sit with someone and work through a real problem."
          ]}
        ]
      },
      {
        "key": "resources",
        "title": "Resources",
        "blocks": [
          { "type": "list", "items": [
            "Tools — AI and dev tools the community actually uses.",
            "Gear guides — coffee setups worth the counter space.",
            "Reads — articles and threads worth the ten minutes."
          ]}
        ]
      },
      {
        "key": "forum",
        "title": "Forum",
        "blocks": [
          { "type": "text", "body": "Questions, project updates, and random tangents all happen in one place. No sub-channels to lose track of, no notifications from six different apps." },
          { "type": "cta", "label": "Join the conversation", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
        ]
      }
    ]
  }
}
```

(i.e. the `account` page's closing `}` gains a trailing comma via the `pages` object's own closing
`}`, followed by the new `"dashboard"` key, before the file's final closing `}`.)

- [ ] **Step 7: Update `src/renderPage.ts`** — add the `afterHero` option and export `renderBlocks`

`renderPage()` currently reads:

```ts
export function renderPage(page: PageData | undefined): string {
  if (!page) {
    return `<div class="py-24 text-center font-brand text-[var(--color-muted)]">content coming soon.</div>`
  }

  const ctaBlocks = page.blocks.filter((b): b is CtaBlock => b.type === 'cta')
  const bodyBlocks = page.blocks.filter((b) => b.type !== 'cta')

  return `
    <section class="relative isolate overflow-hidden border-b border-[var(--color-fg)]/10 bg-[var(--color-panel)]">
      <img src="${withBase('/images/hero-bg.svg')}" alt="" class="pointer-events-none absolute right-[-15%] top-1/2 -z-10 hidden w-[42%] min-w-[300px] -translate-y-1/2 select-none opacity-60 lg:block" />
      <div class="mx-auto max-w-4xl px-6 py-16">
        <h1 class="font-brand text-4xl font-bold sm:text-5xl">${page.title}</h1>
        <p class="mt-4 max-w-xl text-[var(--color-fg)]">${page.intro}</p>
      </div>
    </section>

    <section class="mx-auto max-w-4xl px-6 py-14">
      <div class="space-y-8">
        ${bodyBlocks.map(renderBlock).join('')}
      </div>
    </section>
    ${
      ctaBlocks.length
        ? `<section class="border-t border-[var(--color-fg)]/10 bg-[var(--color-panel)]">
      <div class="mx-auto max-w-4xl px-6 py-14 text-center">
        ${ctaBlocks.map(renderBlock).join('')}
      </div>
    </section>`
        : ''
    }
  `
}
```

Replace the function signature and its closing hero `</section>` with:

```ts
export function renderPage(page: PageData | undefined, opts?: { afterHero?: string }): string {
  if (!page) {
    return `<div class="py-24 text-center font-brand text-[var(--color-muted)]">content coming soon.</div>`
  }

  const ctaBlocks = page.blocks.filter((b): b is CtaBlock => b.type === 'cta')
  const bodyBlocks = page.blocks.filter((b) => b.type !== 'cta')

  return `
    <section class="relative isolate overflow-hidden border-b border-[var(--color-fg)]/10 bg-[var(--color-panel)]">
      <img src="${withBase('/images/hero-bg.svg')}" alt="" class="pointer-events-none absolute right-[-15%] top-1/2 -z-10 hidden w-[42%] min-w-[300px] -translate-y-1/2 select-none opacity-60 lg:block" />
      <div class="mx-auto max-w-4xl px-6 py-16">
        <h1 class="font-brand text-4xl font-bold sm:text-5xl">${page.title}</h1>
        <p class="mt-4 max-w-xl text-[var(--color-fg)]">${page.intro}</p>
      </div>
    </section>
    ${opts?.afterHero ?? ''}

    <section class="mx-auto max-w-4xl px-6 py-14">
      <div class="space-y-8">
        ${bodyBlocks.map(renderBlock).join('')}
      </div>
    </section>
    ${
      ctaBlocks.length
        ? `<section class="border-t border-[var(--color-fg)]/10 bg-[var(--color-panel)]">
      <div class="mx-auto max-w-4xl px-6 py-14 text-center">
        ${ctaBlocks.map(renderBlock).join('')}
      </div>
    </section>`
        : ''
    }
  `
}
```

(only the function signature line and the addition of `${opts?.afterHero ?? ''}` right after the
hero section's closing `</section>` change — everything else in the function body is unchanged.)

Then add this export directly below the `renderPage` function (i.e. after its closing `}`, before
`function renderBlock(block: Block): string {`):

```ts
export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('')
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/content.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Run the full suite to confirm no other test broke**

Run: `npm run test`
Expected: PASS — note the count will be lower than before (74) since `src/pages/learn.ts`,
`resources.ts`, `forum.ts` still exist and reference `site.pages.learn` etc., which are now
`undefined` — this is expected and fixed in Task 2. If any *other* test file fails, stop and
investigate before continuing.

- [ ] **Step 10: Commit**

```bash
git add content/site.json src/renderPage.ts tests/content.test.ts
git commit -m "Migrate Learn/Resources/Forum content into dashboard.sections"
```

---

## Task 2: Delete the old standalone pages

**Files:**
- Delete: `learn.html`, `resources.html`, `forum.html` (repo root)
- Delete: `src/pages/learn.ts`, `src/pages/resources.ts`, `src/pages/forum.ts`
- Modify: `vite.config.ts`
- Modify: `scripts/qc-nav.mjs`

**Interfaces:**
- Consumes: Task 1's `content/site.json` (no more `pages.learn`/`resources`/`forum`, no more nav
  entries for them).
- Produces: a 7-page build (`index.html` + `events`, `shop`, `blog`, `gallery`, `about`,
  `contribute`, `account`) — consumed by Task 3's manual verification and by CI/`npm run build`
  generally.

- [ ] **Step 1: Delete the standalone HTML and page-entry files**

```bash
git rm learn.html resources.html forum.html
git rm src/pages/learn.ts src/pages/resources.ts src/pages/forum.ts
```

- [ ] **Step 2: Update `vite.config.ts`**

Replace:

```ts
const pageSlugs = [
  'events', 'shop', 'resources', 'forum', 'blog',
  'gallery', 'learn', 'about', 'contribute', 'account',
]
```

with:

```ts
const pageSlugs = [
  'events', 'shop', 'blog',
  'gallery', 'about', 'contribute', 'account',
]
```

- [ ] **Step 3: Update `scripts/qc-nav.mjs`**

Replace:

```js
const PAGE_PATHS = [
  '', 'events.html', 'shop.html', 'resources.html', 'forum.html',
  'blog.html', 'gallery.html', 'learn.html', 'about.html',
  'contribute.html', 'account.html',
]
```

with:

```js
const PAGE_PATHS = [
  '', 'events.html', 'shop.html',
  'blog.html', 'gallery.html', 'about.html',
  'contribute.html', 'account.html',
]
```

- [ ] **Step 4: Verify no remaining code references to the deleted pages**

Run: `grep -rn "learn\.html\|resources\.html\|forum\.html\|pages/learn\|pages/resources\|pages/forum" --include='*.ts' --include='*.mjs' --include='*.json' src/ scripts/ vite.config.ts content/site.json`
Expected: no output (empty). If anything matches, it's a dangling reference — fix it before
continuing.

- [ ] **Step 5: Verify the build succeeds with the reduced page set**

Run: `npm run build`
Expected: succeeds, and the "building for production" output lists exactly 8 built HTML files
(`index.html`, `events.html`, `shop.html`, `blog.html`, `gallery.html`, `about.html`,
`contribute.html`, `account.html`) — no `learn.html`/`resources.html`/`forum.html`.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS, same count as Task 1's Step 9 (deleting the dead page files doesn't remove or add
any tests — no test file imports them directly).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Delete standalone Learn/Resources/Forum pages"
```

---

## Task 3: Redesign the Account page — membership-card login panel + dashboard

**Files:**
- Modify: `src/accountAuth.ts`
- Modify: `src/pages/account.ts`
- Test: `tests/accountAuth.test.ts`

**Interfaces:**
- Consumes: `content/site.json`'s `dashboard.sections` (Task 1), `renderBlocks()` from
  `src/renderPage.ts` (Task 1), the `Block` type already exported from `src/renderPage.ts`.
- Produces: `export type DashboardSection = { key: string; title: string; blocks: Block[] }`,
  `renderAuthSection(dashboardSections: DashboardSection[]): string`,
  `mountAuthSection(dashboardSections: DashboardSection[]): void` — both signatures change from
  today's zero-argument form. `src/pages/account.ts` is the only caller and is updated in this task.

- [ ] **Step 1: Write the failing tests**

Replace `tests/accountAuth.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest'
import { renderAuthSection, type DashboardSection } from '../src/accountAuth'

const sections: DashboardSection[] = [
  { key: 'learn', title: 'Learn', blocks: [{ type: 'text', body: 'Learn body' }] },
  { key: 'resources', title: 'Resources', blocks: [{ type: 'text', body: 'Resources body' }] },
  { key: 'forum', title: 'Forum', blocks: [{ type: 'text', body: 'Forum body' }] },
]

describe('renderAuthSection', () => {
  it('renders a signup form with name, whatsapp, and password fields', () => {
    const html = renderAuthSection(sections)
    expect(html).toContain('id="signup-form"')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="whatsappNumber"')
    expect(html).toContain('name="password"')
  })

  it('renders a login form with identifier and password fields', () => {
    const html = renderAuthSection(sections)
    expect(html).toContain('id="login-form"')
    expect(html).toContain('name="identifier"')
  })

  it('renders a logged-in-state container for JS to fill in after checking /api/auth/me', () => {
    const html = renderAuthSection(sections)
    expect(html).toContain('id="account-auth"')
  })

  it('styles the guest forms panel as a bordered membership card', () => {
    const html = renderAuthSection(sections)
    const formsOpenTag = html.match(/<div id="account-auth-forms"[^>]*>/)?.[0] ?? ''
    expect(formsOpenTag).toContain('bg-[var(--color-panel)]')
    expect(formsOpenTag).toContain('border')
  })

  it('gives every password field a show/hide toggle', () => {
    const html = renderAuthSection(sections)
    const passwordFieldCount = (html.match(/type="password"/g) ?? []).length
    const toggleCount = (html.match(/account-toggle-password/g) ?? []).length
    expect(passwordFieldCount).toBe(2)
    expect(toggleCount).toBe(2)
  })

  it('renders every dashboard section title and content in the logged-in view', () => {
    const html = renderAuthSection(sections)
    for (const section of sections) {
      expect(html).toContain(section.title)
    }
    expect(html).toContain('Learn body')
    expect(html).toContain('Resources body')
    expect(html).toContain('Forum body')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/accountAuth.test.ts`
Expected: FAIL — `renderAuthSection` currently takes no arguments and doesn't export
`DashboardSection`, so this fails to even type-check/import correctly, and the membership-card /
password-toggle / dashboard-section assertions all fail against today's markup.

- [ ] **Step 3: Rewrite `src/accountAuth.ts`**

Replace the entire file with:

```ts
import { withBase } from './basePath'
import { renderBlocks, type Block } from './renderPage'

export type DashboardSection = { key: string; title: string; blocks: Block[] }

function renderPasswordField(name: string, placeholder: string, extra = ''): string {
  return `
    <div class="relative">
      <input name="${name}" type="password" placeholder="${placeholder}" required ${extra} class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2 pr-16" />
      <button type="button" class="account-toggle-password absolute right-2 top-1/2 -translate-y-1/2 font-brand text-[10px] uppercase tracking-wide text-[var(--color-muted)] hover:text-[var(--color-fg)]">Show</button>
    </div>
  `
}

function renderDashboardSections(sections: DashboardSection[]): string {
  return `
    <div class="grid gap-4 sm:grid-cols-3">
      ${sections
        .map(
          (s) => `
        <div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 bg-[var(--color-panel)] p-5">
          <h3 class="font-brand font-bold">${s.title}</h3>
          <div class="mt-2 space-y-2 text-sm text-[var(--color-fg)]">${renderBlocks(s.blocks)}</div>
        </div>
      `
        )
        .join('')}
    </div>
  `
}

export function renderAuthSection(dashboardSections: DashboardSection[]): string {
  return `
    <section id="account-auth" class="mx-auto max-w-4xl px-6 py-10">
      <div id="account-auth-loading" class="text-sm text-[var(--color-muted)]">Checking your session…</div>
      <div id="account-auth-loggedin" class="hidden space-y-6">
        <p class="font-brand text-sm uppercase tracking-wide text-[var(--color-muted)]">Welcome back, <span id="account-auth-name" class="font-bold text-[var(--color-fg)]"></span></p>
        ${renderDashboardSections(dashboardSections)}
        <button id="account-auth-logout" type="button" class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log out</button>
      </div>
      <div id="account-auth-forms" class="hidden space-y-8 rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 bg-[var(--color-panel)] p-6">
        <form id="signup-form" class="space-y-2">
          <h3 class="font-brand font-bold">Create an account</h3>
          <input name="name" type="text" placeholder="Name" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          <input name="whatsappNumber" type="tel" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password', 'minlength="8"')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">Sign up</button>
          <p id="signup-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
        <form id="login-form" class="space-y-2">
          <h3 class="font-brand font-bold">Log in</h3>
          <input name="identifier" type="text" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log in</button>
          <p id="login-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
    </section>
  `
}

export function mountAuthSection(dashboardSections: DashboardSection[]): void {
  const loading = document.querySelector<HTMLDivElement>('#account-auth-loading')
  const loggedIn = document.querySelector<HTMLDivElement>('#account-auth-loggedin')
  const forms = document.querySelector<HTMLDivElement>('#account-auth-forms')
  const nameEl = document.querySelector<HTMLSpanElement>('#account-auth-name')
  const logoutBtn = document.querySelector<HTMLButtonElement>('#account-auth-logout')
  const signupForm = document.querySelector<HTMLFormElement>('#signup-form')
  const loginForm = document.querySelector<HTMLFormElement>('#login-form')
  const signupError = document.querySelector<HTMLParagraphElement>('#signup-error')
  const loginError = document.querySelector<HTMLParagraphElement>('#login-error')

  if (!loading || !loggedIn || !forms || !nameEl || !logoutBtn || !signupForm || !loginForm || !signupError || !loginError) {
    return
  }

  document.querySelectorAll<HTMLButtonElement>('.account-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling as HTMLInputElement
      const showing = input.type === 'text'
      input.type = showing ? 'password' : 'text'
      btn.textContent = showing ? 'Show' : 'Hide'
    })
  })

  async function refresh() {
    const res = await fetch(withBase('/api/auth/me'))
    loading!.classList.add('hidden')
    if (res.ok) {
      const user = await res.json()
      nameEl!.textContent = user.name
      loggedIn!.classList.remove('hidden')
      forms!.classList.add('hidden')
    } else {
      loggedIn!.classList.add('hidden')
      forms!.classList.remove('hidden')
    }
  }

  logoutBtn.addEventListener('click', async () => {
    await fetch(withBase('/api/auth/logout'), { method: 'POST' })
    refresh()
  })

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    signupError.textContent = ''
    const form = new FormData(signupForm)
    const res = await fetch(withBase('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        whatsappNumber: form.get('whatsappNumber'),
        password: form.get('password'),
      }),
    })
    if (res.ok) return refresh()
    const body = await res.json().catch(() => ({}))
    signupError.textContent = body.error ?? 'Signup failed.'
  })

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    loginError.textContent = ''
    const form = new FormData(loginForm)
    const res = await fetch(withBase('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }),
    })
    if (res.ok) return refresh()
    loginError.textContent = 'Login failed.'
  })

  refresh()
}
```

Note `dashboardSections` is unused inside `mountAuthSection` itself (the sections are already baked
into the HTML string by `renderAuthSection` before mounting) — it's kept as a parameter for
signature symmetry with `renderAuthSection` and because `src/pages/account.ts` calls both the same
way. This is intentional, not dead code to clean up.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/accountAuth.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Update `src/pages/account.ts`**

Read the current file first (`src/pages/account.ts`), then replace its contents with:

```ts
import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter, mountPlayer } from '../chrome'
import { renderPage } from '../renderPage'
import { renderAuthSection, mountAuthSection } from '../accountAuth'

const dashboardSections = (site as any).dashboard.sections

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'account')}
  <main class="relative isolate overflow-hidden">
    ${renderPage((site.pages as any).account, { afterHero: renderAuthSection(dashboardSections) })}
  </main>
  ${renderFooter(site as any)}
`

mountPlayer(site as any)
mountAuthSection(dashboardSections)
```

This uses the `afterHero` option added to `renderPage()` in Task 1, Step 7 — the auth panel now
renders directly below the hero/intro instead of after the role-ladder content, matching this
spec's "Page structure" section.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS, all files green.

- [ ] **Step 7: Verify visually against the live tunnel**

The tunnel's watch-builder (if running) picks this up automatically. Confirm:

```bash
curl -s https://ags-aidev001.tail7ceefe.ts.net:8443/sig-espresso/account.html | grep -o 'assets/account-[^"]*\.js'
```

then fetch that asset through the funnel and grep for `'Welcome back'` and `'account-toggle-password'`
to confirm the new markup shipped. Then take a screenshot via the browser tool
(`https://ags-aidev001.tail7ceefe.ts.net:8443/sig-espresso/account.html`) to visually confirm: (a)
nav no longer shows Learn/Resources/Forum, (b) the login/signup panel appears directly below the
intro as a bordered card, (c) password fields have a visible Show/Hide toggle.

- [ ] **Step 8: Commit**

```bash
git add src/accountAuth.ts src/pages/account.ts src/renderPage.ts tests/accountAuth.test.ts
git commit -m "Redesign Account page: membership-card login panel + member dashboard"
```

---

## Final check (after all 3 tasks)

- [ ] Run `npm run test` — full suite green.
- [ ] Run `npm run build` — succeeds, 8 pages built.
- [ ] Run `npm run qc <tunnel-or-local-url>` against a running server — 0 problems, nav link count
  is 7.
- [ ] Confirm `docs/superpowers/specs/2026-08-15-account-dashboard-design.md`'s "Out of scope"
  section wasn't accidentally exceeded (no per-user tier data, no server changes).
