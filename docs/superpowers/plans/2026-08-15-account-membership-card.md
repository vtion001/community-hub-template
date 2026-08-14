# Account Membership Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Account page's separate login-panel-then-dashboard-grid with one persistent
ticket-styled "membership card" that plays both roles — Sign up/Log in tabs before you're a member,
Learn/Resources/Forum tabs after.

**Architecture:** `content/site.json`'s `pages.account.blocks` becomes empty (that content now lives
in the card); `renderPage.ts` gains a small addition to skip rendering an empty content section.
`src/accountAuth.ts` is fully rewritten: one card shell (border + two "notch" elements + a static
5-stamp tier illustration built from `site.hero.tiers`) always renders, with a loading/guest/member
three-way toggle inside it — guest and member regions each have their own internal tab switcher,
both wired through one shared `wireTabGroup()` helper instead of duplicated click-handling logic.

**Tech Stack:** Vite + vanilla TypeScript, Tailwind v4 (CSS custom properties), Vitest.

## Global Constraints

- Frontend-only — no `server/` changes.
- No new dependencies.
- Stamps are plain filled/outlined circles (not per-stamp icons) and there is no mascot-cutout badge
  on the card — both are deliberate scope trims from the exploratory mockups, not omissions to fix.
- The stamp track is a **static illustration of the tier ladder concept**, identical in every auth
  state. It must never be made to look like it's showing a specific user's personal progress — the
  backend has no per-user tier field.
- `wireTabGroup()` must be written once and reused for both tab groups (Sign up/Log in, and
  Learn/Resources/Forum) — no duplicated tab-click-handling logic.
- Match existing codebase conventions exactly: Tailwind arbitrary-value classes referencing
  `var(--color-*)` tokens, no `style="..."` attributes, no new CSS files, `withBase()` wraps every
  internal/external href the same way the rest of the codebase already does.

---

## Task 1: Empty-blocks handling — renderPage.ts + content/site.json

**Files:**
- Modify: `src/renderPage.ts`
- Modify: `content/site.json`
- Test: `tests/renderPage.test.ts`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces: `renderPage()` (signature unchanged: `(page: PageData | undefined, opts?: { afterHero?: string }) => string`) now omits its content `<section>` entirely when `page.blocks` is empty, instead of rendering an empty, padded one — consumed by Task 2 (the Account page will have zero blocks after this task).
- Produces: `content/site.json`'s `pages.account.blocks` is `[]` — consumed by Task 2 (via `src/pages/account.ts`, unchanged in this task).

- [ ] **Step 1: Write the failing tests**

In `tests/renderPage.test.ts`, replace this existing test:

```ts
  it('has no content sections at all when there are zero blocks beyond header', () => {
    const html = renderPage({ title: 'T', intro: 'I', blocks: [] })
    const sectionCount = (html.match(/<section /g) || []).length
    expect(sectionCount).toBe(2)
  })
```

with:

```ts
  it('has no content section at all when there are zero blocks beyond header', () => {
    const html = renderPage({ title: 'T', intro: 'I', blocks: [] })
    const sectionCount = (html.match(/<section /g) || []).length
    expect(sectionCount).toBe(1)
  })

  it('omits the content section entirely (not just an empty one) when blocks is empty', () => {
    const html = renderPage({ title: 'T', intro: 'I', blocks: [] })
    expect(html).not.toContain('space-y-8')
  })
```

(This is a deliberate behavior change from the existing test's expectation — previously the content
section always rendered, even empty; now it's omitted entirely to avoid a dead, padded gap on the
page. The new test replaces the old one rather than sitting alongside a contradictory assertion.)

In `tests/content.test.ts`, replace this existing test:

```ts
  it('every page has a non-empty title, intro, and at least one block', () => {
    for (const slug of PAGE_SLUGS) {
      const page = (site.pages as Record<string, { title: string; intro: string; blocks: unknown[] }>)[slug]
      expect(page.title.length).toBeGreaterThan(0)
      expect(page.intro.length).toBeGreaterThan(0)
      expect(page.blocks.length).toBeGreaterThan(0)
    }
  })
```

with:

```ts
  it('every page has a non-empty title and intro; every page except Account also has at least one block', () => {
    for (const slug of PAGE_SLUGS) {
      const page = (site.pages as Record<string, { title: string; intro: string; blocks: unknown[] }>)[slug]
      expect(page.title.length).toBeGreaterThan(0)
      expect(page.intro.length).toBeGreaterThan(0)
      if (slug !== 'account') {
        expect(page.blocks.length).toBeGreaterThan(0)
      }
    }
  })

  it('Account page has zero body blocks — its content lives entirely in the membership card', () => {
    const page = (site.pages as any).account
    expect(page.blocks.length).toBe(0)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderPage.test.ts tests/content.test.ts`
Expected: FAIL — `renderPage()` still always renders the content section (sectionCount is 2, not 1;
`space-y-8` is present), and `pages.account.blocks` still has 3 entries, not 0.

- [ ] **Step 3: Update `src/renderPage.ts`**

Replace:

```ts
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

with:

```ts
    ${
      bodyBlocks.length
        ? `<section class="mx-auto max-w-4xl px-6 py-14">
      <div class="space-y-8">
        ${bodyBlocks.map(renderBlock).join('')}
      </div>
    </section>`
        : ''
    }
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

- [ ] **Step 4: Update `content/site.json`**

Replace:

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
```

with:

```json
    "account": {
      "title": "Account",
      "intro": "Sign in below, or create an account if you're already in the WhatsApp group.",
      "blocks": []
    }
```

(This is the final entry in `pages`, immediately before the closing `}` of `pages` and the
`"dashboard"` key that follows it — only the `account` object's contents change, nothing around it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/renderPage.test.ts tests/content.test.ts`
Expected: PASS (16 tests in renderPage.test.ts, 7 in content.test.ts)

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: PASS overall, EXCEPT `tests/accountAuth.test.ts` will now fail — the Account page's
`renderAuthSection`/`mountAuthSection` still assume the old `pages.account.blocks` content lived
outside the card, and `src/pages/account.ts` / `src/accountAuth.ts` haven't been touched yet. This
is expected and fixed in Task 2. If any test OTHER than `tests/accountAuth.test.ts` fails, stop and
investigate before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/renderPage.ts content/site.json tests/renderPage.test.ts tests/content.test.ts
git commit -m "Skip empty content section in renderPage; empty Account page blocks"
```

Append this to the commit message (both lines, verbatim):
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw
```

---

## Task 2: The membership card — rewrite accountAuth.ts

**Files:**
- Modify: `src/accountAuth.ts`
- Modify: `src/pages/account.ts`
- Test: `tests/accountAuth.test.ts`

**Interfaces:**
- Consumes: `content/site.json`'s `dashboard.sections` (unchanged shape from before), `site.hero.tiers`
  (`string[]`, already exists, no shape change needed), `site.nav.cta.href` (`string`, already
  exists), `renderBlocks()` and `Block` type from `src/renderPage.ts` (unchanged), `withBase()` from
  `src/basePath.ts` (unchanged).
- Produces: `export type DashboardSection = { key: string; title: string; blocks: Block[] }`
  (unchanged), `renderAuthSection(dashboardSections: DashboardSection[], tiers: string[], whatsappHref: string): string`
  (signature CHANGES from 1 argument to 3), `mountAuthSection(): void` (signature CHANGES from 1
  argument to 0 — nothing inside the mount logic needs dashboard/tier/link data any more, since it's
  all already baked into the static HTML by render time).

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
const tiers = ['NEWCOMER', 'BUILDER', 'MENTOR', 'VETERAN', 'LEGEND']
const whatsappHref = 'https://chat.whatsapp.com/test'

describe('renderAuthSection', () => {
  it('renders the card shell with ticket notches', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    expect(html).toContain('id="account-auth"')
    expect(html).toContain('-left-[7px]')
    expect(html).toContain('-right-[7px]')
  })

  it('renders one stamp per tier, with only the first one filled', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    const stampCount = (html.match(/<span class="h-5 w-5 rounded-full/g) ?? []).length
    expect(stampCount).toBe(tiers.length)
    const filledCount = (html.match(/h-5 w-5 rounded-full bg-\[var\(--color-accent\)\]/g) ?? []).length
    expect(filledCount).toBe(1)
  })

  it('shows the static ladder caption, not a personal progress claim', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    expect(html).toContain('Everyone starts as a Newcomer and moves up by showing up.')
  })

  it('defaults the card label to "Membership Card"', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    expect(html).toContain('id="account-card-label">Membership Card<')
  })

  it('renders Sign up and Log in tabs with both forms in the guest region', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    expect(html).toContain('data-tab="signup"')
    expect(html).toContain('data-tab="login"')
    expect(html).toContain('id="signup-form"')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="whatsappNumber"')
    expect(html).toContain('id="login-form"')
    expect(html).toContain('name="identifier"')
  })

  it('gives every password field a show/hide toggle', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    const passwordFieldCount = (html.match(/type="password"/g) ?? []).length
    const toggleCount = (html.match(/account-toggle-password/g) ?? []).length
    expect(passwordFieldCount).toBe(2)
    expect(toggleCount).toBe(2)
  })

  it('renders the WhatsApp join link in the guest region', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    expect(html).toContain(`href="${whatsappHref}"`)
    expect(html).toContain('Join via WhatsApp')
  })

  it('renders a tab and content for every dashboard section in the member region', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    for (const section of sections) {
      expect(html).toContain(`data-tab="${section.key}"`)
      expect(html).toContain(`data-tab-panel="${section.key}"`)
      expect(html).toContain(section.title)
    }
    expect(html).toContain('Learn body')
    expect(html).toContain('Resources body')
    expect(html).toContain('Forum body')
  })

  it('renders a logout button in the member region', () => {
    const html = renderAuthSection(sections, tiers, whatsappHref)
    expect(html).toContain('id="account-auth-logout"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/accountAuth.test.ts`
Expected: FAIL — `renderAuthSection` currently takes 1 argument, not 3, and none of the new
card/tab/stamp markup exists yet.

- [ ] **Step 3: Rewrite `src/accountAuth.ts`**

Replace the entire file with:

```ts
import { withBase } from './basePath'
import { renderBlocks, type Block } from './renderPage'

export type DashboardSection = { key: string; title: string; blocks: Block[] }

function renderPasswordField(name: string, placeholder: string, fieldLabel: string, extra = ''): string {
  return `
    <div class="relative">
      <input name="${name}" type="password" placeholder="${placeholder}" required ${extra} class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2 pr-16" />
      <button type="button" class="account-toggle-password absolute right-2 top-1/2 -translate-y-1/2 font-brand text-[10px] uppercase tracking-wide text-[var(--color-muted)] hover:text-[var(--color-fg)]" data-field-label="${fieldLabel}" aria-label="Show ${fieldLabel}">Show</button>
    </div>
  `
}

function renderStampTrack(tiers: string[]): string {
  return `
    <div class="mb-3 flex items-baseline justify-between font-brand text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
      <span id="account-card-label">Membership Card</span>
      <span>${tiers[0]} &rarr; ${tiers[tiers.length - 1]}</span>
    </div>
    <div class="mb-3 flex gap-2">
      ${tiers
        .map(
          (t, i) =>
            `<span class="h-5 w-5 rounded-full ${i === 0 ? 'bg-[var(--color-accent)]' : 'border border-[var(--color-fg)]/20'}" title="${t}"></span>`
        )
        .join('')}
    </div>
    <p class="mb-6 font-brand text-[10px] text-[var(--color-muted)]">Everyone starts as a Newcomer and moves up by showing up.</p>
  `
}

function renderTabs(tabs: { key: string; label: string }[]): string {
  return `
    <div class="mb-4 flex gap-4 border-b border-[var(--color-fg)]/10 pb-2 font-brand text-xs uppercase tracking-wide">
      ${tabs.map((t) => `<button type="button" class="account-tab text-[var(--color-muted)]" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>
  `
}

function renderGuestRegion(whatsappHref: string): string {
  return `
    <div id="account-card-guest" class="hidden">
      ${renderTabs([
        { key: 'signup', label: 'Sign up' },
        { key: 'login', label: 'Log in' },
      ])}
      <div data-tab-panel="signup">
        <form id="signup-form" class="space-y-2">
          <input name="name" type="text" placeholder="Name" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          <input name="whatsappNumber" type="tel" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password', 'new account password', 'minlength="8"')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">Sign up</button>
          <p id="signup-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
      <div data-tab-panel="login" class="hidden">
        <form id="login-form" class="space-y-2">
          <input name="identifier" type="text" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password', 'login password')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log in</button>
          <p id="login-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
      <a href="${withBase(whatsappHref)}" class="mt-4 block text-center font-brand text-xs uppercase tracking-wide text-[var(--color-accent-text)] hover:underline">Join via WhatsApp</a>
    </div>
  `
}

function renderMemberRegion(dashboardSections: DashboardSection[]): string {
  return `
    <div id="account-card-member" class="hidden">
      ${renderTabs(dashboardSections.map((s) => ({ key: s.key, label: s.title })))}
      ${dashboardSections
        .map(
          (s) => `
        <div data-tab-panel="${s.key}" class="space-y-2 text-sm text-[var(--color-fg)]">
          ${renderBlocks(s.blocks)}
        </div>
      `
        )
        .join('')}
      <button id="account-auth-logout" type="button" class="mt-4 w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log out</button>
    </div>
  `
}

export function renderAuthSection(dashboardSections: DashboardSection[], tiers: string[], whatsappHref: string): string {
  return `
    <section id="account-auth" class="mx-auto max-w-md px-6 py-10">
      <div class="relative rounded-[var(--radius-brand)] border border-[var(--color-fg)]/60 bg-white p-6">
        <span class="absolute -left-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full border border-[var(--color-fg)]/60 bg-[var(--color-bg)]"></span>
        <span class="absolute -right-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full border border-[var(--color-fg)]/60 bg-[var(--color-bg)]"></span>

        ${renderStampTrack(tiers)}

        <div id="account-auth-loading" class="text-sm text-[var(--color-muted)]">Checking your session…</div>

        ${renderGuestRegion(whatsappHref)}
        ${renderMemberRegion(dashboardSections)}
      </div>
    </section>
  `
}

export function mountAuthSection(): void {
  const loading = document.querySelector<HTMLDivElement>('#account-auth-loading')
  const guest = document.querySelector<HTMLDivElement>('#account-card-guest')
  const member = document.querySelector<HTMLDivElement>('#account-card-member')
  const label = document.querySelector<HTMLSpanElement>('#account-card-label')
  const logoutBtn = document.querySelector<HTMLButtonElement>('#account-auth-logout')
  const signupForm = document.querySelector<HTMLFormElement>('#signup-form')
  const loginForm = document.querySelector<HTMLFormElement>('#login-form')
  const signupError = document.querySelector<HTMLParagraphElement>('#signup-error')
  const loginError = document.querySelector<HTMLParagraphElement>('#login-error')

  if (!loading || !guest || !member || !label || !logoutBtn || !signupForm || !loginForm || !signupError || !loginError) {
    return
  }

  function wireTabGroup(root: HTMLElement): void {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.account-tab'))
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-tab-panel]'))

    function activate(target: string) {
      tabs.forEach((t) => {
        const active = t.dataset.tab === target
        t.classList.toggle('text-[var(--color-fg)]', active)
        t.classList.toggle('font-bold', active)
        t.classList.toggle('border-b-2', active)
        t.classList.toggle('border-[var(--color-accent)]', active)
        t.classList.toggle('text-[var(--color-muted)]', !active)
      })
      panels.forEach((p) => {
        p.classList.toggle('hidden', p.dataset.tabPanel !== target)
      })
    }

    tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab!)))
    if (tabs.length) activate(tabs[0].dataset.tab!)
  }

  wireTabGroup(guest)
  wireTabGroup(member)

  document.querySelectorAll<HTMLButtonElement>('.account-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling as HTMLInputElement
      const showing = input.type === 'text'
      input.type = showing ? 'password' : 'text'
      btn.textContent = showing ? 'Show' : 'Hide'
      btn.setAttribute('aria-label', `${showing ? 'Show' : 'Hide'} ${btn.dataset.fieldLabel}`)
    })
  })

  async function refresh() {
    const res = await fetch(withBase('/api/auth/me'))
    loading!.classList.add('hidden')
    if (res.ok) {
      const user = await res.json()
      label!.textContent = `Welcome back, ${user.name}`
      member!.classList.remove('hidden')
      guest!.classList.add('hidden')
    } else {
      label!.textContent = 'Membership Card'
      member!.classList.add('hidden')
      guest!.classList.remove('hidden')
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/accountAuth.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Update `src/pages/account.ts`**

Replace the entire file with:

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
    ${renderPage((site.pages as any).account, {
      afterHero: renderAuthSection(dashboardSections, site.hero.tiers, site.nav.cta.href),
    })}
  </main>
  ${renderFooter(site as any)}
`

mountPlayer(site as any)
mountAuthSection()
```

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: PASS, all files green.

- [ ] **Step 7: Run the production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Verify visually against the live tunnel**

If the tunnel's watch-builder (`npm run tunnel:build`) is running, it picks this up automatically —
otherwise run `npm run build` and restart it. Confirm via the browser tool
(`https://ags-aidev001.tail7ceefe.ts.net:8443/sig-espresso/account.html`):
- Logged out: card shows "Membership Card" label, 5 stamps (first one filled), the static caption,
  Sign up/Log in tabs (Sign up active by default) with both forms reachable, WhatsApp link below the
  forms, password show/hide toggle on both password fields.
- Log in with a real test account (or sign up a new one if the WhatsApp roster allows it in this
  environment) and confirm: label switches to "Welcome back, {name}", tabs switch to Learn/
  Resources/Forum (Learn active by default), clicking each tab shows that section's content, Log out
  button works and returns to the guest state.
- Mobile width (resize to ~390px): card stays readable, notches/stamps don't overflow or wrap badly.

- [ ] **Step 9: Commit**

```bash
git add src/accountAuth.ts src/pages/account.ts tests/accountAuth.test.ts
git commit -m "Rebuild Account page as a single membership-card component"
```

Append this to the commit message (both lines, verbatim):
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw
```

---

## Final check (after both tasks)

- [ ] Run `npm run test` — full suite green.
- [ ] Run `npm run build` — succeeds.
- [ ] Run `npm run qc <tunnel-or-local-url>` against a running server — 0 problems.
- [ ] Confirm the spec's "Out of scope" items weren't accidentally exceeded (no backend changes, no
  fabricated per-user tier data, no bespoke mascot asset added, no other page touched).
