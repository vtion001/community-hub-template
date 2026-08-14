# Events Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Events page a purpose-built layout — tagged format cards plus an honest "Where" (locations) section — by extending the shared `renderPage.ts` block system with two small, reusable additions, and updating `content/site.json` to use them.

**Architecture:** `src/renderPage.ts`'s `cards` block gains an optional per-item `tag` field (rendered as a small uppercase mono label) and its grid gains a `lg:grid-cols-3` breakpoint; a new `heading` block type is added for labeling sub-sections. Both are additive and backward-compatible — no changes to `src/pages/events.ts`, `src/chrome.ts`, or any other page's content. `content/site.json`'s `pages.events` is then rewritten to use the new block types.

**Tech Stack:** TypeScript, Vite, Tailwind v4 (`@theme` tokens in `src/style.css`), Vitest (`node` environment, no DOM — tests assert against raw HTML strings), Playwright (breakpoint screenshot verification only, via its CLI — no new script file).

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-08-13-events-page-design.md`.)

- No new image/icon assets — the tag treatment reuses existing typographic/mono styling only (same visual vocabulary as the hero's tier list and nav links).
- The `tag` field on cards items must be optional and fully backward-compatible — existing untagged cards on Blog/Gallery/Shop must render unchanged.
- No real Luma embed/API integration and no fabricated event dates — the "Where" section states the honest current status only ("Real dates will show here once our Luma calendar is live...").
- No new automated visual-regression tooling — breakpoint verification is a manual/scripted screenshot check, not a persisted test file.
- All page content changes flow through `content/site.json`; no page-specific render logic is added to `src/pages/events.ts`.
- Tests run in Vitest's `node` environment (no jsdom) — assert against raw HTML strings returned by `renderPage`/`renderBlock`, matching `tests/renderPage.test.ts`'s existing style.

---

## Task 1: Add optional `tag` field to the `cards` block

**Files:**
- Modify: `src/renderPage.ts:5` (`CardsBlock` type), `src/renderPage.ts:52-58` (`renderBlock`'s `'cards'` case)
- Test: `tests/renderPage.test.ts` (new cases inside the existing `describe('renderPage', ...)` block, after the existing "renders a cards block" test at line 40)

**Interfaces:**
- Consumes: nothing new — extends the existing exported `renderPage(page: PageData | undefined): string` from `src/renderPage.ts`.
- Produces: `CardsBlock`'s item type becomes `{ title: string; body: string; tag?: string }`. Later tasks (Task 4) rely on cards items accepting an optional `tag`.

- [ ] **Step 1: Write the failing tests**

Add these two cases to `tests/renderPage.test.ts`, directly after the existing `it('renders a cards block', ...)` test (currently ending at line 40):

```ts
  it('renders a card tag when present', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'cards', items: [{ tag: 'DROP IN', title: 'Card A', body: 'Body A' }] }],
    })
    expect(html).toContain('DROP IN')
  })

  it('renders no tag element when a card has no tag', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'cards', items: [{ title: 'Card A', body: 'Body A' }] }],
    })
    expect(html).not.toContain('<span')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/renderPage.test.ts -t "renders a card tag"`
Expected: FAIL — `expect(html).toContain('DROP IN')` fails because `tag` is not yet rendered (or the test doesn't even compile-fail, since TS types aren't checked at test-run time in this repo — it fails on the runtime assertion instead).

- [ ] **Step 3: Add the `tag` field to `CardsBlock` and render it**

In `src/renderPage.ts`, change line 5 from:

```ts
export type CardsBlock = { type: 'cards'; items: { title: string; body: string }[] }
```

to:

```ts
export type CardsBlock = { type: 'cards'; items: { title: string; body: string; tag?: string }[] }
```

Then replace the `'cards'` case in `renderBlock` (lines 52-58):

```ts
    case 'cards':
      return `<div class="grid gap-4 sm:grid-cols-2">${block.items
        .map(
          (c) =>
            `<div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 p-5"><h3 class="font-brand font-bold">${c.title}</h3><p class="mt-2 text-sm text-[var(--color-muted)]">${c.body}</p></div>`
        )
        .join('')}</div>`
```

with:

```ts
    case 'cards':
      return `<div class="grid gap-4 sm:grid-cols-2">${block.items
        .map(
          (c) =>
            `<div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 p-5">${
              c.tag
                ? `<span class="mb-2 inline-block border-b border-[var(--color-muted)]/40 pb-1 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)]">${c.tag}</span>`
                : ''
            }<h3 class="font-brand font-bold">${c.title}</h3><p class="mt-2 text-sm text-[var(--color-muted)]">${c.body}</p></div>`
        )
        .join('')}</div>`
```

(The grid class `sm:grid-cols-2` stays as-is for now — it's fixed in Task 2.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/renderPage.test.ts`
Expected: PASS — all tests in the file pass, including the two new ones and the pre-existing "renders a cards block" test (unaffected, since `tag` is optional).

- [ ] **Step 5: Commit**

```bash
git add src/renderPage.ts tests/renderPage.test.ts
git commit -m "Add optional tag field to cards block

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 2: Fix the cards grid to flow 3-across on desktop

**Files:**
- Modify: `src/renderPage.ts` (the `'cards'` case's grid wrapper, edited in Task 1)
- Test: `tests/renderPage.test.ts`

**Interfaces:**
- Consumes: the `'cards'` case from Task 1 (same file/location, immediately after Task 1's edit).
- Produces: the cards grid wrapper now includes the class `lg:grid-cols-3` — verified by later manual breakpoint check in Task 5.

- [ ] **Step 1: Write the failing test**

Add this case to `tests/renderPage.test.ts`, after the two tests added in Task 1:

```ts
  it('renders the cards grid with a 3-column desktop breakpoint', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'cards', items: [{ title: 'Card A', body: 'Body A' }] }],
    })
    expect(html).toContain('lg:grid-cols-3')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/renderPage.test.ts -t "3-column desktop breakpoint"`
Expected: FAIL — `lg:grid-cols-3` is not present in the current grid class (`sm:grid-cols-2` only).

- [ ] **Step 3: Update the grid class**

In `src/renderPage.ts`, in the `'cards'` case (from Task 1), change:

```ts
      return `<div class="grid gap-4 sm:grid-cols-2">${block.items
```

to:

```ts
      return `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${block.items
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/renderPage.test.ts`
Expected: PASS — all tests pass, including the new grid-class test.

- [ ] **Step 5: Commit**

```bash
git add src/renderPage.ts tests/renderPage.test.ts
git commit -m "Flow cards grid 3-across on desktop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 3: Add the `heading` block type

**Files:**
- Modify: `src/renderPage.ts:1-8` (type definitions), `src/renderPage.ts:44-51` (`renderBlock`'s `switch` statement)
- Test: `tests/renderPage.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: a new exported type `HeadingBlock = { type: 'heading'; text: string }`, added to the `Block` union. Task 4 relies on `{ type: 'heading', text: string }` being a valid block in `content/site.json`.

- [ ] **Step 1: Write the failing test**

Add this case to `tests/renderPage.test.ts`, after the grid-class test from Task 2:

```ts
  it('renders a heading block', () => {
    const html = renderPage({
      title: 'T', intro: 'I',
      blocks: [{ type: 'heading', text: 'Where' }],
    })
    expect(html).toContain('Where')
    expect(html).toContain('<h2')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/renderPage.test.ts -t "renders a heading block"`
Expected: FAIL — `'heading'` isn't a handled case in `renderBlock`'s switch, so this throws (no case matches and the function falls through returning `undefined`, which fails the `toContain` assertions) or is a TypeScript error surfaced at runtime as a thrown exception depending on how the switch is written. Either way, the test does not pass yet.

- [ ] **Step 3: Add the `HeadingBlock` type and render case**

In `src/renderPage.ts`, change the type definitions at the top of the file from:

```ts
export type TextBlock = { type: 'text'; body: string }
export type ListBlock = { type: 'list'; items: string[] }
export type CardsBlock = { type: 'cards'; items: { title: string; body: string; tag?: string }[] }
export type CtaBlock = { type: 'cta'; label: string; href: string }
export type Block = TextBlock | ListBlock | CardsBlock | CtaBlock
```

to:

```ts
export type TextBlock = { type: 'text'; body: string }
export type ListBlock = { type: 'list'; items: string[] }
export type CardsBlock = { type: 'cards'; items: { title: string; body: string; tag?: string }[] }
export type CtaBlock = { type: 'cta'; label: string; href: string }
export type HeadingBlock = { type: 'heading'; text: string }
export type Block = TextBlock | ListBlock | CardsBlock | CtaBlock | HeadingBlock
```

Then add a case to the `switch` statement in `renderBlock` (currently `text` / `list` / `cards` / `cta`), inserting it before the `case 'cta':` line:

```ts
    case 'heading':
      return `<h2 class="font-brand text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">${block.text}</h2>`
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/renderPage.test.ts`
Expected: PASS — all tests in the file pass, including the new heading test.

- [ ] **Step 5: Commit**

```bash
git add src/renderPage.ts tests/renderPage.test.ts
git commit -m "Add heading block type to renderPage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 4: Update the Events page content

**Files:**
- Modify: `content/site.json:61-72` (the `pages.events` object)

**Interfaces:**
- Consumes: the `tag` field on `cards` items (Task 1) and the `heading` block type (Task 3).
- Produces: `site.pages.events` now uses tagged cards + a heading + a second cards block, consumed at runtime by `src/pages/events.ts` (unmodified) via `renderPage(site.pages.events)`.

- [ ] **Step 1: Replace the events block in `content/site.json`**

Replace lines 61-72 (the entire `"events": { ... }` object, from `"events": {` through its closing `},`):

```json
    "events": {
      "title": "Events",
      "intro": "No paid workshops, no ticket prices — just regular reasons to show up in person.",
      "blocks": [
        { "type": "list", "items": [
          "Casual meetups — coffee, conversation, no agenda.",
          "Show-and-tell sessions — bring something you built, five minutes, no judgment.",
          "Coworking sessions — bring your laptop, work alongside people, ask for help when stuck."
        ]},
        { "type": "cta", "label": "Join WhatsApp for dates", "href": "https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0" }
      ]
    },
```

with:

```json
    "events": {
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
    },
```

- [ ] **Step 2: Run the full test suite to verify nothing broke**

Run: `npm run test`
Expected: PASS — all suites pass, including `tests/content.test.ts` (its shape checks — non-empty title/intro/blocks per page — already cover this content without modification) and `tests/renderPage.test.ts` (unaffected, tests use inline fixtures, not `site.json`).

- [ ] **Step 3: Commit**

```bash
git add content/site.json
git commit -m "Update Events page content: tagged formats + Where section

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 5: Verify the layout across breakpoints

**Files:**
- None modified — this task only runs the dev server and captures verification screenshots (gitignored, not committed).

**Interfaces:**
- Consumes: the built Events page from Tasks 1-4 (`npm run dev` serving `events.html`).
- Produces: two PNG screenshots for visual confirmation, at `docs/design/build-events-desktop.png` and `docs/design/build-events-mobile.png` (both match the existing `.gitignore` pattern `docs/design/build-*.png` — they will not be committed).

- [ ] **Step 1: Start the dev server in the background**

Run: `npm run dev` (background)
Expected: Output includes `Local: http://localhost:5173/` (Vite's default port). Wait a few seconds for it to be ready.

- [ ] **Step 2: Capture the desktop screenshot (1440×900 — expect 3-across cards)**

Run: `npx playwright screenshot --viewport-size=1440,900 http://localhost:5173/events.html docs/design/build-events-desktop.png`
Expected: `docs/design/build-events-desktop.png` is created. Command exits 0.

- [ ] **Step 3: Capture the mobile screenshot (390×844 — expect stacked single column)**

Run: `npx playwright screenshot --viewport-size=390,844 http://localhost:5173/events.html docs/design/build-events-mobile.png`
Expected: `docs/design/build-events-mobile.png` is created. Command exits 0.

- [ ] **Step 4: View both screenshots and confirm the layout**

View `docs/design/build-events-desktop.png`: the "DROP IN" / "SHOW & TELL" / "COWORK" cards form a single row of 3 equal-width cards; below them, the "Where" label appears above a single "Metro Manila" card; the "Join WhatsApp for dates" CTA band appears last, visually separated (per `renderPage.ts`'s existing CTA-band extraction).

View `docs/design/build-events-mobile.png`: all cards stack in a single column (the `sm:grid-cols-2 lg:grid-cols-3` classes both fail to apply below the `sm` breakpoint, so the grid's implicit single-column default applies); content remains readable with no horizontal overflow.

If either screenshot doesn't match (e.g., cards wrap to 2-over-1 on desktop, or content overflows horizontally on mobile), stop and re-check the grid class from Task 2 before proceeding.

- [ ] **Step 5: Stop the dev server**

Stop the background `npm run dev` process (e.g., via the shell job control or process manager available in your environment — the dev server has no further use once screenshots are captured).

- [ ] **Step 6: Run the full test and QC suite one last time**

Run: `npm run test`
Expected: PASS — all suites pass.

Run: `npm run build`
Expected: build succeeds for all 11 HTML entries, no errors.

No commit for this task — screenshots are gitignored verification artifacts, and no source files were modified.
