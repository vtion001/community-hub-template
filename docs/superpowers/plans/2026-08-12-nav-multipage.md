# Nav Multi-Page Build + Cozy Palette Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 10 dead `#`-anchor nav items into 10 real, working pages, and switch the site from its dark-ink/amber theme to a light cream/terracotta theme matching the logo.

**Architecture:** Vite multi-page app — 10 new real HTML entry points, each rendered by a thin TS file that composes two new shared pure-function modules (`src/chrome.ts` for nav/footer, `src/renderPage.ts` for page body content) against a single `content/site.json` source of truth.

**Tech Stack:** Vite + vanilla TypeScript + Tailwind v4 (existing). Adds `vitest` as a new dev dependency — justified because `chrome.ts` and `renderPage.ts` are pure string-in/string-out functions, ideal for fast unit tests that don't require spinning up a browser; DOM-mounting glue and cross-page navigation stay covered by the existing Playwright QC pattern already used in this project.

## Global Constraints

- All content is original — nothing copied or derived from ai-and-coffee.com or any other reference site (per `README.md` → Origin). This applies to every page's copy written in this plan.
- The palette switch is a full replacement, not a second theme — old dark-ink (`#14151a`) / amber (`#ffb020`) tokens are removed entirely, not kept alongside the new ones.
- No backend, auth, or e-commerce — Account and Shop pages are informational only, with WhatsApp CTAs instead of login/cart/checkout.
- No new frontend framework or client-side router — stays vanilla TS + Vite MPA, per the approved design (Approach A).
- No inline `style=` attributes, no JS-based hover/focus handlers — Tailwind utility classes only, matching the project's existing grep-gated convention.
- WhatsApp invite link used throughout: `https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0`

---

### Task 1: Extend `content/site.json` with page content and real nav links

**Files:**
- Modify: `content/site.json`
- Create: `tests/content.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency and `test` script)

**Interfaces:**
- Produces: `site.nav.items[].slug` (string, matches a `site.pages` key), `site.pages.<slug>` = `{ title: string; intro: string; blocks: Block[] }` where `Block` is one of `{type:'text',body}`, `{type:'list',items:string[]}`, `{type:'cards',items:{title,body}[]}`, `{type:'cta',label,href}`. Later tasks (`src/renderPage.ts`, `src/chrome.ts`) consume this shape.

- [ ] **Step 1: Install vitest**

Run: `cd C:\Users\VJ_Rodriguguez\desktop\repository\community-hub-template && export PATH="$PATH:/d/Dump Installations/nodejs" && npm install --no-save --save-dev vitest`
Expected: installs cleanly, no errors.

- [ ] **Step 2: Add the test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write the failing test** — `tests/content.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import site from '../content/site.json'

const PAGE_SLUGS = [
  'events', 'shop', 'resources', 'forum', 'blog',
  'gallery', 'learn', 'about', 'contribute', 'account',
]

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
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/content.test.ts`
Expected: FAIL — `site.pages` is undefined and nav items have no `slug`.

- [ ] **Step 6: Replace `content/site.json` in full**

```json
{
  "brand": {
    "name": "Sig & Espresso",
    "shortName": "S&E",
    "logo": "/images/logo.svg"
  },
  "nav": {
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
    "cta": { "label": "Join", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
  },
  "hero": {
    "headlineLines": [
      { "text": "SIG", "tone": "accent" },
      { "text": "&", "tone": "base" },
      { "text": "ESPRESSO", "tone": "accent" }
    ],
    "taglineLines": ["no résumés.", "no small talk.", "no dress code."],
    "ruleLine": "no titles. no gatekeeping. just show up.",
    "tiers": ["NEWCOMER", "BUILDER", "MENTOR", "VETERAN", "LEGEND"],
    "ctaPrimary": { "label": "Join WhatsApp", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" },
    "ctaSecondary": { "label": "Upcoming Events", "href": "/events.html" },
    "illustration": "/images/hero-bg.svg"
  },
  "statsBlock": {
    "lines": ["no algorithms.", "just people.", "growing @ 500+ members"],
    "links": [
      { "label": "gallery", "href": "/gallery.html" },
      { "label": "github", "href": "#" }
    ]
  },
  "ticker": {
    "text": "128 members online now"
  },
  "pages": {
    "events": {
      "title": "Events",
      "intro": "No paid workshops, no ticket prices \u2014 just regular reasons to show up in person.",
      "blocks": [
        { "type": "list", "items": [
          "Casual meetups \u2014 coffee, conversation, no agenda.",
          "Show-and-tell sessions \u2014 bring something you built, five minutes, no judgment.",
          "Coworking sessions \u2014 bring your laptop, work alongside people, ask for help when stuck."
        ]},
        { "type": "cta", "label": "Join WhatsApp for dates", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    },
    "shop": {
      "title": "Shop",
      "intro": "Small-batch merch, made for the community, not a storefront.",
      "blocks": [
        { "type": "cards", "items": [
          { "title": "Mug", "body": "Ceramic, holds a full pot's worth of patience." },
          { "title": "Tote bag", "body": "Canvas, fits a laptop and a bag of beans." },
          { "title": "Sticker pack", "body": "Five stickers, one per member tier." }
        ]},
        { "type": "cta", "label": "DM us on WhatsApp to order", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    },
    "resources": {
      "title": "Resources",
      "intro": "Things members keep coming back to \u2014 added as we find them, not sold to you.",
      "blocks": [
        { "type": "list", "items": [
          "Tools \u2014 AI and dev tools the community actually uses.",
          "Gear guides \u2014 coffee setups worth the counter space.",
          "Reads \u2014 articles and threads worth the ten minutes."
        ]}
      ]
    },
    "forum": {
      "title": "Forum",
      "intro": "There's no separate forum software \u2014 the WhatsApp group is the forum.",
      "blocks": [
        { "type": "text", "body": "Questions, project updates, and random tangents all happen in one place. No sub-channels to lose track of, no notifications from six different apps." },
        { "type": "cta", "label": "Join the conversation", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    },
    "blog": {
      "title": "Blog",
      "intro": "Occasional write-ups from members \u2014 coming soon.",
      "blocks": [
        { "type": "cards", "items": [
          { "title": "Why we don't do r\u00e9sum\u00e9s", "body": "Coming soon." },
          { "title": "Notes from the first coworking session", "body": "Coming soon." },
          { "title": "A show-and-tell roundup", "body": "Coming soon." }
        ]}
      ]
    },
    "gallery": {
      "title": "Gallery",
      "intro": "Photos from meetups \u2014 this fills in as we run more events.",
      "blocks": [
        { "type": "cards", "items": [
          { "title": "Meetup #1", "body": "Photos coming soon." },
          { "title": "Show & Tell Night", "body": "Photos coming soon." },
          { "title": "Coworking Session", "body": "Photos coming soon." }
        ]}
      ]
    },
    "learn": {
      "title": "Learn",
      "intro": "Low-pressure ways to pick things up from other members.",
      "blocks": [
        { "type": "list", "items": [
          "Intro nights \u2014 beginner-friendly walkthroughs of AI tools.",
          "Workshops \u2014 hands-on, small group, bring a laptop.",
          "Pairing sessions \u2014 sit with someone and work through a real problem."
        ]}
      ]
    },
    "about": {
      "title": "About",
      "intro": "Sig & Espresso started as a coffee-and-code hangout, without the gatekeeping.",
      "blocks": [
        { "type": "text", "body": "No coaching program, no paid course, no sales pitches. Just people who like coffee, tech, and honest conversation, meeting up regularly." },
        { "type": "list", "items": [
          "NEWCOMER \u2014 just joined, welcome.",
          "BUILDER \u2014 showed up a few times, shipping things.",
          "MENTOR \u2014 helps newer members find their footing.",
          "VETERAN \u2014 been around a while, knows the regulars.",
          "LEGEND \u2014 the people everyone already knows."
        ]}
      ]
    },
    "contribute": {
      "title": "Contribute",
      "intro": "This community runs on people pitching in, not a budget.",
      "blocks": [
        { "type": "list", "items": [
          "Host an event \u2014 casual meetup, show-and-tell, or coworking session.",
          "Write a resource guide \u2014 a tool, a gear setup, a read worth sharing.",
          "Help with the site \u2014 this page is open source."
        ]},
        { "type": "cta", "label": "GitHub", "href": "#" }
      ]
    },
    "account": {
      "title": "Account",
      "intro": "There's no login here \u2014 membership works through the WhatsApp group.",
      "blocks": [
        { "type": "text", "body": "Everyone starts as a Newcomer and moves up by showing up \u2014 no application, no approval process." },
        { "type": "list", "items": [
          "NEWCOMER \u2014 just joined.",
          "BUILDER \u2014 regular at meetups, sharing what you're working on.",
          "MENTOR \u2014 helping newer members.",
          "VETERAN \u2014 long-time regular.",
          "LEGEND \u2014 community fixture."
        ]},
        { "type": "cta", "label": "Join via WhatsApp", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    }
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/content.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add content/site.json tests/content.test.ts vitest.config.ts package.json package-lock.json
git commit -m "Add page content + nav slugs to site.json, add vitest"
```

---

### Task 2: Switch palette to cozy cream/terracotta theme

**Files:**
- Modify: `src/style.css`
- Modify: `public/images/hero-bg.svg`
- Create: `tests/palette.test.ts`

**Interfaces:**
- Produces: `--color-bg: #fbf3e7`, `--color-fg: #4a342a`, `--color-accent: #d98255`, `--color-panel: #f0e6d6` (deeper cream than bg) — consumed by every render function written in later tasks via the existing `var(--color-*)` Tailwind arbitrary-value pattern already used in `src/main.ts`.

- [ ] **Step 1: Write the failing test** — `tests/palette.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8')
const svg = readFileSync(path.resolve(__dirname, '../public/images/hero-bg.svg'), 'utf8')

describe('cozy palette tokens', () => {
  it('uses the cream background token', () => {
    expect(css).toContain('#fbf3e7')
  })
  it('uses the coffee-brown text token', () => {
    expect(css).toContain('#4a342a')
  })
  it('uses the terracotta accent token', () => {
    expect(css).toContain('#d98255')
  })
  it('no longer references the old dark-ink background', () => {
    expect(css).not.toContain('#14151a')
  })
  it('no longer references the old amber accent', () => {
    expect(css).not.toContain('#ffb020')
  })
})

describe('hero illustration recolor', () => {
  it('no longer uses the near-white stroke meant for a dark background', () => {
    expect(svg).not.toContain('#F2F0EA')
  })
  it('uses a muted brown stroke that reads on a light background', () => {
    expect(svg).toContain('#4A342A')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/palette.test.ts`
Expected: FAIL — old tokens still present, new ones missing.

- [ ] **Step 3: Replace `src/style.css` in full**

```css
@import "tailwindcss";

@theme {
  --font-mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

  --color-bg: #fbf3e7;
  --color-fg: #4a342a;
  --color-muted: #9c8a7d;
  --color-accent: #d98255;
  --color-panel: #f0e6d6;

  --radius-brand: 6px;
}

body {
  background-color: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
}

.font-brand {
  font-family: var(--font-mono);
}
```

- [ ] **Step 4: Recolor `public/images/hero-bg.svg`**

Replace the file in full — same artwork/composition, strokes/fills recolored from near-white (`#F2F0EA`, built for a dark background) to muted brown (`#4A342A`), and opacity raised slightly (0.16 → 0.22) since brown-on-cream needs a touch more contrast than white-on-dark did:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700" fill="none">
  <!-- Original decorative line-art duo: a hammer-head builder and a lightbulb idea-maker. -->
  <g stroke="#4A342A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.22">

    <!-- Character A: hammer-head builder -->
    <g>
      <!-- head (hammer shape) -->
      <rect x="120" y="70" width="220" height="110" rx="18"/>
      <rect x="205" y="180" width="50" height="70" rx="10"/>
      <!-- face -->
      <circle cx="200" cy="120" r="9" fill="#4A342A"/>
      <circle cx="260" cy="120" r="9" fill="#4A342A"/>
      <path d="M195 150 Q230 170 265 150"/>
      <!-- torso -->
      <rect x="150" y="250" width="160" height="220" rx="30"/>
      <!-- arms -->
      <path d="M150 300 Q70 320 55 400"/>
      <circle cx="50" cy="415" r="26"/>
      <path d="M310 300 Q400 260 430 190"/>
      <circle cx="440" cy="175" r="26"/>
      <!-- legs -->
      <path d="M190 470 Q170 560 140 630"/>
      <circle cx="130" cy="645" r="24"/>
      <path d="M270 470 Q300 560 335 630"/>
      <circle cx="345" cy="645" r="24"/>
    </g>

    <!-- Character B: lightbulb idea-maker -->
    <g>
      <!-- head (bulb shape) -->
      <circle cx="640" cy="230" r="120"/>
      <path d="M600 340 h80 v30 h-80 z"/>
      <path d="M615 385 h50"/>
      <path d="M615 405 h50"/>
      <!-- filament face -->
      <circle cx="605" cy="215" r="9" fill="#4A342A"/>
      <circle cx="675" cy="215" r="9" fill="#4A342A"/>
      <path d="M600 260 Q640 285 680 260"/>
      <!-- torso -->
      <rect x="580" y="430" width="140" height="200" rx="28"/>
      <!-- arms -->
      <path d="M580 470 Q500 450 470 380"/>
      <circle cx="460" cy="365" r="24"/>
      <path d="M720 470 Q800 500 830 570"/>
      <circle cx="840" cy="585" r="24"/>
      <!-- legs -->
      <path d="M615 630 Q600 660 585 690"/>
      <circle cx="578" cy="700" r="20"/>
      <path d="M685 630 Q700 660 715 690"/>
      <circle cx="722" cy="700" r="20"/>
    </g>
  </g>
</svg>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/palette.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/style.css public/images/hero-bg.svg tests/palette.test.ts
git commit -m "Switch palette to cozy cream/terracotta theme, recolor hero illustration"
```

---

### Task 3: `src/renderPage.ts` — pure page-body renderer

**Files:**
- Create: `src/renderPage.ts`
- Create: `tests/renderPage.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure function, only reads its own parameter).
- Produces: `renderPage(page: PageData | undefined): string` and exported types `PageData`, `Block`. Consumed by Task 6's per-page entry files as `renderPage((site.pages as any).<slug>)`.

- [ ] **Step 1: Write the failing test** — `tests/renderPage.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { renderPage } from '../src/renderPage'

describe('renderPage', () => {
  it('renders the fallback when page data is missing', () => {
    const html = renderPage(undefined)
    expect(html).toContain('content coming soon')
  })

  it('renders title and intro', () => {
    const html = renderPage({ title: 'Events', intro: 'Come hang out.', blocks: [] })
    expect(html).toContain('Events')
    expect(html).toContain('Come hang out.')
  })

  it('renders a text block', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'text', body: 'Hello there.' }],
    })
    expect(html).toContain('Hello there.')
  })

  it('renders a list block', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'list', items: ['One', 'Two'] }],
    })
    expect(html).toContain('<li>One</li>')
    expect(html).toContain('<li>Two</li>')
  })

  it('renders a cards block', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'cards', items: [{ title: 'Card A', body: 'Body A' }] }],
    })
    expect(html).toContain('Card A')
    expect(html).toContain('Body A')
  })

  it('renders a cta block', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'cta', label: 'Join', href: '/join' }],
    })
    expect(html).toContain('href="/join"')
    expect(html).toContain('Join')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderPage.test.ts`
Expected: FAIL — `../src/renderPage` does not exist.

- [ ] **Step 3: Create `src/renderPage.ts`**

```ts
export type TextBlock = { type: 'text'; body: string }
export type ListBlock = { type: 'list'; items: string[] }
export type CardsBlock = { type: 'cards'; items: { title: string; body: string }[] }
export type CtaBlock = { type: 'cta'; label: string; href: string }
export type Block = TextBlock | ListBlock | CardsBlock | CtaBlock
export type PageData = { title: string; intro: string; blocks: Block[] }

export function renderPage(page: PageData | undefined): string {
  if (!page) {
    return `<div class="py-24 text-center font-brand text-[var(--color-muted)]">content coming soon.</div>`
  }
  return `
    <h1 class="font-brand text-4xl font-bold sm:text-5xl">${page.title}</h1>
    <p class="mt-4 max-w-2xl text-[var(--color-fg)]">${page.intro}</p>
    <div class="mt-10 space-y-8">
      ${page.blocks.map(renderBlock).join('')}
    </div>
  `
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'text':
      return `<p class="max-w-2xl text-[var(--color-fg)]">${block.body}</p>`
    case 'list':
      return `<ul class="list-disc space-y-2 pl-5 text-[var(--color-fg)]">${block.items
        .map((i) => `<li>${i}</li>`)
        .join('')}</ul>`
    case 'cards':
      return `<div class="grid gap-4 sm:grid-cols-2">${block.items
        .map(
          (c) =>
            `<div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 p-5"><h3 class="font-brand font-bold">${c.title}</h3><p class="mt-2 text-sm text-[var(--color-muted)]">${c.body}</p></div>`
        )
        .join('')}</div>`
    case 'cta':
      return `<a href="${block.href}" class="inline-block rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-6 py-3 font-brand text-sm font-bold uppercase text-[var(--color-bg)] hover:opacity-90">${block.label}</a>`
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderPage.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderPage.ts tests/renderPage.test.ts
git commit -m "Add renderPage: pure page-body renderer for text/list/cards/cta blocks"
```

---

### Task 4: `src/chrome.ts` — pure nav/footer renderer with active-page highlighting

**Files:**
- Create: `src/chrome.ts`
- Create: `tests/chrome.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure function).
- Produces: `renderHeader(site: SiteChrome, activePage: string): string`, `renderFooter(site: SiteChrome): string`, exported type `SiteChrome`. Consumed by Task 5 (`src/main.ts`) and Task 6 (all 10 page entry files).

- [ ] **Step 1: Write the failing test** — `tests/chrome.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { renderHeader, renderFooter } from '../src/chrome'

const site = {
  brand: { name: 'Sig & Espresso', shortName: 'S&E', logo: '/images/logo.svg' },
  nav: {
    items: [
      { label: 'Events', href: '/events.html', slug: 'events' },
      { label: 'Shop', href: '/shop.html', slug: 'shop' },
    ],
    cta: { label: 'Join', href: 'https://example.com' },
  },
  ticker: { text: '128 members online now' },
}

describe('renderHeader', () => {
  it('renders all nav items', () => {
    const html = renderHeader(site, 'events')
    expect(html).toContain('Events')
    expect(html).toContain('Shop')
  })

  it('marks the active page nav item', () => {
    const html = renderHeader(site, 'events')
    const eventsLink = html.match(/<a href="\/events\.html"[^>]*>/)![0]
    expect(eventsLink).toContain('border-[var(--color-accent)]')
  })

  it('does not mark inactive nav items as active', () => {
    const html = renderHeader(site, 'events')
    const shopLink = html.match(/<a href="\/shop\.html"[^>]*>/)![0]
    expect(shopLink).not.toContain('border-[var(--color-accent)]')
  })

  it('renders the brand name and join CTA', () => {
    const html = renderHeader(site, 'home')
    expect(html).toContain('Sig & Espresso')
    expect(html).toContain('https://example.com')
  })
})

describe('renderFooter', () => {
  it('renders the ticker text and brand short name', () => {
    const html = renderFooter(site)
    expect(html).toContain('128 members online now')
    expect(html).toContain('S&E')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chrome.test.ts`
Expected: FAIL — `../src/chrome` does not exist.

- [ ] **Step 3: Create `src/chrome.ts`**

```ts
export type NavItem = { label: string; href: string; slug: string }
export type SiteChrome = {
  brand: { name: string; shortName: string; logo: string }
  nav: { items: NavItem[]; cta: { label: string; href: string } }
  ticker: { text: string }
}

export function renderHeader(site: SiteChrome, activePage: string): string {
  const navLinks = site.nav.items
    .map((item) => {
      const isActive = item.slug === activePage
      const cls = isActive
        ? 'text-[var(--color-fg)] border-b-2 border-[var(--color-accent)]'
        : 'hover:text-[var(--color-fg)]'
      return `<a href="${item.href}" class="${cls}">${item.label}</a>`
    })
    .join('')

  return `
    <header class="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-[var(--color-fg)]/10 bg-[var(--color-bg)]/95 px-6 py-3 backdrop-blur">
      <a href="/" class="flex items-center gap-2 font-brand text-sm tracking-wide">
        <img src="${site.brand.logo}" alt="" width="32" height="32" />
        ${site.brand.name}
      </a>
      <nav class="hidden flex-1 items-center justify-center gap-5 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)] lg:flex">
        ${navLinks}
      </nav>
      <a href="${site.nav.cta.href}" class="rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 font-brand text-xs font-bold uppercase text-[var(--color-bg)] hover:opacity-90">
        ${site.nav.cta.label}
      </a>
    </header>
  `
}

export function renderFooter(site: SiteChrome): string {
  return `
    <footer class="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-[var(--color-fg)]/10 bg-[var(--color-panel)] px-6 py-3 font-brand text-xs text-[var(--color-muted)]">
      <span class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-[var(--color-accent)]"></span>
        ${site.ticker.text}
      </span>
      <span>${site.brand.shortName}</span>
    </footer>
  `
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chrome.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/chrome.ts tests/chrome.test.ts
git commit -m "Add chrome: pure nav/footer renderer with active-page highlighting"
```

---

### Task 5: Refactor `src/main.ts` (home page) to use the shared chrome module

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `renderHeader(site, 'home')` and `renderFooter(site)` from Task 4's `src/chrome.ts`.
- Produces: nothing new (this is the home page's own entry, not consumed by others).

- [ ] **Step 1: Replace `src/main.ts` in full**

```ts
import './style.css'
import site from '../content/site.json'
import { renderHeader, renderFooter } from './chrome'

const tone = (t: string) => (t === 'accent' ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]')

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  ${renderHeader(site as any, 'home')}

  <main class="relative isolate overflow-hidden">
    <img src="${site.hero.illustration}" alt="" class="pointer-events-none absolute right-[-8%] top-10 -z-10 hidden w-[55%] min-w-[420px] select-none md:block" />

    <section class="mx-auto max-w-6xl px-6 py-20">
      <h1 class="font-brand text-5xl font-bold leading-[0.95] sm:text-7xl">
        ${site.hero.headlineLines.map((l) => `<span class="block ${tone(l.tone)}">${l.text}</span>`).join('')}
      </h1>

      <div class="mt-8 space-y-1 font-brand text-lg text-[var(--color-fg)]">
        ${site.hero.taglineLines.map((l) => `<p>${l}</p>`).join('')}
        <p class="font-bold">${site.hero.ruleLine}</p>
      </div>

      <ul class="mt-6 flex flex-wrap gap-4 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)]">
        ${site.hero.tiers.map((t) => `<li class="border-b border-[var(--color-muted)]/40 pb-1">${t}</li>`).join('')}
      </ul>

      <div class="mt-8 flex flex-wrap gap-4">
        <a href="${site.hero.ctaPrimary.href}" class="rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-6 py-3 font-brand text-sm font-bold uppercase text-[var(--color-bg)] hover:opacity-90">
          ${site.hero.ctaPrimary.label}
        </a>
        <a href="${site.hero.ctaSecondary.href}" class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-6 py-3 font-brand text-sm font-bold uppercase hover:border-[var(--color-fg)]">
          ${site.hero.ctaSecondary.label}
        </a>
      </div>

      <div class="mt-24 max-w-xs text-right font-brand text-xs text-[var(--color-muted)] ml-auto">
        ${site.statsBlock.lines.map((l) => `<p>${l}</p>`).join('')}
        <p class="mt-2 space-x-3">
          ${site.statsBlock.links.map((l) => `<a href="${l.href}" class="hover:text-[var(--color-fg)]">${l.label}</a>`).join('')}
        </p>
      </div>
    </section>
  </main>

  ${renderFooter(site as any)}
`
```

- [ ] **Step 2: Build and verify no TypeScript/runtime errors**

Run: `cd C:\Users\VJ_Rodriguguez\desktop\repository\community-hub-template && export PATH="$PATH:/d/Dump Installations/nodejs" && npx vite build`
Expected: build succeeds, `dist/index.html` produced.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "Refactor home page to use shared chrome module (dedupe nav/footer)"
```

---

### Task 6: Create the 10 real nav pages (HTML entries + TS entries) and wire the multi-page build

**Files:**
- Create: `events.html`, `shop.html`, `resources.html`, `forum.html`, `blog.html`, `gallery.html`, `learn.html`, `about.html`, `contribute.html`, `account.html` (repo root, alongside existing `index.html`)
- Create: `src/pages/events.ts`, `src/pages/shop.ts`, `src/pages/resources.ts`, `src/pages/forum.ts`, `src/pages/blog.ts`, `src/pages/gallery.ts`, `src/pages/learn.ts`, `src/pages/about.ts`, `src/pages/contribute.ts`, `src/pages/account.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `renderHeader`/`renderFooter` (Task 4), `renderPage` (Task 3), `site.pages.<slug>` (Task 1).
- Produces: 10 working routes, each reachable at `/<slug>.html`.

- [ ] **Step 1: Create `src/pages/events.ts`** (the template — repeat exactly for the other 9, substituting only the slug per the table in Step 3)

```ts
import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter } from '../chrome'
import { renderPage } from '../renderPage'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'events')}
  <main class="mx-auto max-w-4xl px-6 py-16">
    ${renderPage((site.pages as any).events)}
  </main>
  ${renderFooter(site as any)}
`
```

- [ ] **Step 2: Create `events.html`** (the template — repeat exactly for the other 9, substituting only `<title>` text and the script `src` path per the table in Step 3)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Events — Sig & Espresso</title>
    <link rel="icon" href="/images/logo.svg" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/pages/events.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Repeat Steps 1–2 for the remaining 9 slugs**

Each `src/pages/<slug>.ts` is byte-identical to `events.ts` above except the two occurrences of `'events'` (the `renderHeader(..., 'events')` argument and `(site.pages as any).events`) are replaced with `<slug>`. Each `<slug>.html` is byte-identical to `events.html` above except the `<title>` text and the `<script src="/src/pages/<slug>.ts">` path.

| File pair | slug | `<title>` text |
|---|---|---|
| `shop.ts` / `shop.html` | `shop` | `Shop — Sig & Espresso` |
| `resources.ts` / `resources.html` | `resources` | `Resources — Sig & Espresso` |
| `forum.ts` / `forum.html` | `forum` | `Forum — Sig & Espresso` |
| `blog.ts` / `blog.html` | `blog` | `Blog — Sig & Espresso` |
| `gallery.ts` / `gallery.html` | `gallery` | `Gallery — Sig & Espresso` |
| `learn.ts` / `learn.html` | `learn` | `Learn — Sig & Espresso` |
| `about.ts` / `about.html` | `about` | `About — Sig & Espresso` |
| `contribute.ts` / `contribute.html` | `contribute` | `Contribute — Sig & Espresso` |
| `account.ts` / `account.html` | `account` | `Account — Sig & Espresso` |

Example for `shop` (write this one fully, then apply the same substitution for the other 8):

`src/pages/shop.ts`:
```ts
import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter } from '../chrome'
import { renderPage } from '../renderPage'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'shop')}
  <main class="mx-auto max-w-4xl px-6 py-16">
    ${renderPage((site.pages as any).shop)}
  </main>
  ${renderFooter(site as any)}
`
```

`shop.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shop — Sig & Espresso</title>
    <link rel="icon" href="/images/logo.svg" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/pages/shop.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Wire all 11 entries into the production build** — replace `vite.config.ts` in full

```ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

function buildMetaPlugin() {
  let sha = 'dev'
  try {
    sha = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // no git repo yet — fine for local dev
  }
  const stamp = `${sha}-${new Date().toISOString()}`
  return {
    name: 'build-meta',
    transformIndexHtml(html: string) {
      return html.replace(
        '</head>',
        `  <meta name="x-build" content="${stamp}">\n  </head>`
      )
    },
  }
}

const root = fileURLToPath(new URL('.', import.meta.url))
const pageSlugs = [
  'events', 'shop', 'resources', 'forum', 'blog',
  'gallery', 'learn', 'about', 'contribute', 'account',
]

export default defineConfig({
  plugins: [tailwindcss(), buildMetaPlugin()],
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        ...Object.fromEntries(
          pageSlugs.map((slug) => [slug, path.resolve(root, `${slug}.html`)])
        ),
      },
    },
  },
})
```

- [ ] **Step 5: Build and verify all 11 HTML outputs exist**

Run: `cd C:\Users\VJ_Rodriguguez\desktop\repository\community-hub-template && export PATH="$PATH:/d/Dump Installations/nodejs" && npx vite build && ls dist/*.html`
Expected: 11 files listed — `index.html`, `events.html`, `shop.html`, `resources.html`, `forum.html`, `blog.html`, `gallery.html`, `learn.html`, `about.html`, `contribute.html`, `account.html`.

- [ ] **Step 6: Commit**

```bash
git add events.html shop.html resources.html forum.html blog.html gallery.html learn.html about.html contribute.html account.html src/pages vite.config.ts
git commit -m "Add 10 real nav pages, wire multi-page Vite build"
```

---

### Task 7: Full QC pass — grep gates + Playwright nav click-through across all 11 pages

**Files:**
- Create: `scripts/qc-nav.mjs`

**Interfaces:**
- Consumes: the built `dist/` output from Task 6 (served via `vite preview`).
- Produces: pass/fail signal for the REVIEW/GATE stage; no code consumed by later tasks.

- [ ] **Step 1: Run the existing grep gates**

Run (from project root, bash):
```bash
echo "--- inline styles ---"; grep -rn "style=" src/ *.html || echo "none found"
echo "--- JS hover handlers ---"; grep -rniE "onmouseover|onmouseenter|addEventListener\(.mouseenter" src/ || echo "none found"
echo "--- reference-site leakage ---"; grep -rniE "ai.?and.?coffee|clueless|whales|sharks" src/ content/ public/ *.html || echo "none found"
```
Expected: all three print "none found".

- [ ] **Step 2: Write `scripts/qc-nav.mjs`**

```js
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:4400'
const PAGE_PATHS = [
  '', 'events.html', 'shop.html', 'resources.html', 'forum.html',
  'blog.html', 'gallery.html', 'learn.html', 'about.html',
  'contribute.html', 'account.html',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const problems = []
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console error on ${page.url()}: ${msg.text()}`) })
page.on('pageerror', (err) => problems.push(`pageerror on ${page.url()}: ${err.message}`))
page.on('response', (res) => { if (res.status() >= 400) problems.push(`HTTP ${res.status()} for ${res.url()}`) })

for (const p of PAGE_PATHS) {
  await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' })
}

// nav click-through, starting from home
await page.goto(BASE, { waitUntil: 'networkidle' })
const navCount = await page.locator('header nav a').count()
console.log('nav link count:', navCount)
for (let i = 0; i < navCount; i++) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const link = page.locator('header nav a').nth(i)
  const href = await link.getAttribute('href')
  await link.click()
  await page.waitForLoadState('networkidle')
  if (!page.url().endsWith(href)) {
    problems.push(`nav click ${i} expected to land on ${href}, got ${page.url()}`)
  }
}

// mobile viewport sanity pass
await page.setViewportSize({ width: 390, height: 844 })
for (const p of PAGE_PATHS) {
  await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' })
}

console.log('problems:', JSON.stringify(problems))
await browser.close()
process.exit(problems.length ? 1 : 0)
```

- [ ] **Step 3: Build, serve, and run the QC script**

Run:
```bash
cd C:\Users\VJ_Rodriguguez\desktop\repository\community-hub-template
export PATH="$PATH:/d/Dump Installations/nodejs"
npx vite build
nohup npx vite preview --port 4400 --strictPort --host 127.0.0.1 > /tmp/preview.log 2>&1 &
sleep 3
node scripts/qc-nav.mjs http://127.0.0.1:4400
```
Expected: `problems: []`, exit code 0, `nav link count: 10`.

- [ ] **Step 4: Stop the preview server**

Run: `pkill -f "vite preview"`

- [ ] **Step 5: Commit**

```bash
git add scripts/qc-nav.mjs
git commit -m "Add Playwright nav click-through QC script, verify all gates pass"
```

---

### Task 8: Update README and run the full test suite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`** — add to the `## Structure` section (append after the existing `docs/design/` line):

```
src/chrome.ts             # shared nav/footer renderer (pure functions)
src/renderPage.ts         # generic page-body renderer (text/list/cards/cta blocks)
src/pages/                # one thin entry file per nav page
*.html (root)              # 11 real pages: index + one per nav item
tests/                     # vitest unit tests for chrome.ts, renderPage.ts, content shape, palette
scripts/qc-nav.mjs         # Playwright QC: nav click-through + console/error checks across all pages
```

Also update the palette line under `## Origin` from the dark-ink/amber description to:
```
- Palette: cream `#fbf3e7` background / coffee-brown `#4a342a` text / terracotta `#d98255` accent (own token set in `src/style.css`), matching the logo
```

- [ ] **Step 2: Run the full test suite**

Run: `cd C:\Users\VJ_Rodriguguez\desktop\repository\community-hub-template && export PATH="$PATH:/d/Dump Installations/nodejs" && npx vitest run`
Expected: all tests pass (content, palette, renderPage, chrome — 21 tests total).

- [ ] **Step 3: Final build check**

Run: `npx vite build`
Expected: succeeds, 11 HTML outputs in `dist/`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Update README for multi-page structure and cozy palette"
```
