// Reusable reference-site wireframe extractor.
//
// Captures a reference page's STRUCTURE only (layout blueprint) so a variant
// site can be rebuilt "exactly as it is" structurally without any of the
// reference's copy, images, or brand assets ever entering the build.
//
// Usage: node scripts/wireframe-extract.mjs <url> <slug>
//
// Hard rules (enforced in code, do not relax):
//   - Never persist image URLs or binaries from the target.
//   - Never store more than 30 chars of any text node (heading labels are
//     truncated to 30 chars + an ellipsis char, so max stored length is 31).
//   - User-agent a normal desktop Chrome.
//   - Single pass, polite: one page per invocation, no crawling/following
//     links beyond the given URL.
//
// Output: docs/design/<slug>/
//   home-desktop-full.jpeg   1440px viewport, full page
//   home-mobile-full.jpeg    390px viewport, full page
//   wireframe.json           section-by-section structural blueprint
//   tokens.json              sampled design tokens (fonts/colors/spacing)
//   WIREFRAME.md             human-readable blueprint generated from JSON

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }

const MODAL_DISMISS_SELECTORS = [
  '#onetrust-accept-btn-handler',
  'button:has-text("Accept All")',
  'button:has-text("Accept all")',
  'button:has-text("Accept")',
  'button:has-text("I Agree")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  '[aria-label="Close"]',
  '[aria-label="close"]',
  '.modal-close',
  'button[class*="close" i]',
  '.cookie-consent button',
]

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const [, , url, slug] = process.argv
if (!url || !slug) {
  console.error('Usage: node scripts/wireframe-extract.mjs <url> <slug>')
  process.exit(1)
}
if (!/^https?:\/\//.test(url)) {
  console.error(`Refusing non-http(s) url: ${url}`)
  process.exit(1)
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`slug must be lowercase alnum/hyphen only, got: ${slug}`)
  process.exit(1)
}

const OUT_DIR = path.join('docs/design', slug)
await mkdir(OUT_DIR, { recursive: true })

// ---------------------------------------------------------------------------
// In-browser extraction logic (runs inside page.evaluate — no closures over
// outer scope, everything self-contained so it can cross the CDP boundary).
// ---------------------------------------------------------------------------

/* eslint-disable no-undef */
function extractInBrowser() {
  const VIEWPORT_W = window.innerWidth

  // getComputedStyle/getBoundingClientRect can throw on a live, third-party-
  // script-laden page (ads/chat-widget/translate-widget frameworks can leave
  // stray or cross-realm nodes reachable from querySelectorAll('*')). Every
  // call goes through this safe wrapper so one odd element can't crash the
  // whole extraction — callers treat `null` as "skip this element".
  function safeCS(el) {
    try {
      return getComputedStyle(el)
    } catch {
      return null
    }
  }
  function safeRect(el) {
    try {
      return el.getBoundingClientRect()
    } catch {
      return null
    }
  }

  function isVisible(el) {
    const r = safeRect(el)
    if (!r || r.width <= 0 || r.height <= 0) return false
    const cs = safeCS(el)
    if (!cs) return false
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
    // Must actually intersect the horizontal viewport bounds. Off-canvas
    // drawers/mobile menus are often positioned via a large negative x (or
    // translateX) rather than display:none, so width/height/visibility all
    // look "visible" even though the panel sits entirely off-screen. Only
    // checking horizontal bounds (not vertical) is deliberate: the page is
    // captured full-page, so content far below the fold is still valid.
    if (r.right <= 0 || r.left >= window.innerWidth) return false
    return true
  }

  function truncateLabel(text, max = 30) {
    const clean = (text || '').trim().replace(/\s+/g, ' ')
    if (clean.length <= max) return clean
    return clean.slice(0, max) + '…'
  }

  function rgbToHex(rgb) {
    if (!rgb) return null
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (!m) return null
    const [, r, g, b, a] = m
    if (a !== undefined && parseFloat(a) === 0) return null
    return '#' + [r, g, b].map((x) => parseInt(x, 10).toString(16).padStart(2, '0')).join('')
  }

  function findBackground(el) {
    let cur = el
    let depth = 0
    while (cur && depth < 12) {
      const cs = safeCS(cur)
      const hex = cs ? rgbToHex(cs.backgroundColor) : null
      if (hex) return hex
      cur = cur.parentElement
      depth++
    }
    return '#ffffff'
  }

  // Splits a resolved grid-template-columns value into tracks, respecting
  // parens (e.g. minmax(0px, 1fr)) so we don't split inside a function call.
  function splitTracks(str) {
    const tracks = []
    let depth = 0
    let cur = ''
    for (const ch of str) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ' ' && depth === 0) {
        if (cur) tracks.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    if (cur) tracks.push(cur)
    return tracks
  }

  function sizeBucket(w, h) {
    const big = Math.max(w, h)
    if (h >= 400 || w >= VIEWPORT_W * 0.7) return 'hero'
    if (h >= 200 || w >= 500) return 'large'
    if (h >= 80 || w >= 150) return 'card'
    if (big > 0) return 'thumb'
    return 'thumb'
  }

  function mediaPosition(rect, sectionRect) {
    const xCenter = rect.left + rect.width / 2 - sectionRect.left
    const third = sectionRect.width / 3
    if (rect.width >= sectionRect.width * 0.85) return 'full'
    if (xCenter < third) return 'left'
    if (xCenter > third * 2) return 'right'
    return 'center'
  }

  function collectMedia(root, sectionRect) {
    const items = []
    root.querySelectorAll('img').forEach((img) => {
      if (!isVisible(img)) return
      const r = safeRect(img)
      if (!r || r.width < 20 || r.height < 20) return
      items.push({
        type: 'image',
        aspectRatio: Math.round((r.width / r.height) * 100) / 100,
        sizeBucket: sizeBucket(r.width, r.height),
        position: mediaPosition(r, sectionRect),
      })
    })
    // Background-video hero/lifestyle sections are common and easy to miss
    // if only <img>/background-image are checked.
    root.querySelectorAll('video').forEach((video) => {
      if (!isVisible(video)) return
      const r = safeRect(video)
      if (!r || r.width < 20 || r.height < 20) return
      items.push({
        type: 'video',
        aspectRatio: Math.round((r.width / r.height) * 100) / 100,
        sizeBucket: sizeBucket(r.width, r.height),
        position: mediaPosition(r, sectionRect),
      })
    })
    root.querySelectorAll('*').forEach((el) => {
      if (el.tagName === 'IMG' || el.tagName === 'VIDEO') return
      const cs = safeCS(el)
      if (!cs) return
      const bg = cs.backgroundImage
      if (!bg || bg === 'none' || !bg.includes('url(')) return
      if (!isVisible(el)) return
      const r = safeRect(el)
      if (!r || r.width < 20 || r.height < 20) return
      items.push({
        type: 'image',
        aspectRatio: Math.round((r.width / r.height) * 100) / 100,
        sizeBucket: sizeBucket(r.width, r.height),
        position: mediaPosition(r, sectionRect),
      })
    })
    return items
  }

  function ctaCount(root) {
    let count = 0
    root.querySelectorAll('a, button').forEach((el) => {
      if (!isVisible(el)) return
      const cs = safeCS(el)
      if (!cs) return
      const bg = rgbToHex(cs.backgroundColor)
      const hasBorder = parseFloat(cs.borderWidth) > 0 && cs.borderStyle !== 'none'
      const looksLikeCta =
        /btn|button|cta/i.test(el.className || '') ||
        el.getAttribute('role') === 'button' ||
        bg !== null ||
        hasBorder
      if (looksLikeCta) count++
    })
    return count
  }

  function textArchitecture(root) {
    const headings = []
    root.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
      if (!isVisible(h)) return
      if (!h.textContent || !h.textContent.trim()) return
      headings.push({ level: Number(h.tagName[1]), label: truncateLabel(h.textContent), semantic: true })
    })
    // Fallback: many sites style a plain <div>/<span class="title"> instead
    // of a real heading tag for section titles. If no semantic heading was
    // found, surface the most specific visible "title"-classed element as a
    // pseudo-heading (level 0) — accurate that it's non-semantic, but still
    // useful structural info for a rebuild.
    if (headings.length === 0) {
      const candidates = [...root.querySelectorAll('[class*="title" i]')].filter((el) => {
        if (!isVisible(el)) return false
        const text = (el.textContent || '').trim()
        return text.length > 0 && text.length <= 100
      })
      if (candidates.length) {
        // Largest font-size wins (section titles are styled bigger than
        // nested card/item sub-titles that also happen to match
        // [class*="title"]); DOM order breaks ties.
        const best = candidates
          .map((el) => ({ el, size: parseFloat(safeCS(el)?.fontSize) || 0 }))
          .sort((a, b) => b.size - a.size)[0].el
        headings.push({ level: 0, label: truncateLabel(best.textContent), semantic: false })
      }
    }
    const paragraphCount = [...root.querySelectorAll('p')].filter(
      (p) => isVisible(p) && p.textContent && p.textContent.trim().length > 0,
    ).length
    const chars = (root.innerText || '').length
    const density = chars < 300 ? 'low' : chars < 1000 ? 'med' : 'high'
    return { headings, paragraphCount, density, ctaCount: ctaCount(root) }
  }

  // Carousels/sliders commonly keep multiple (or duplicate) slides in the
  // DOM at once for infinite-loop scrolling — heading/paragraph/CTA/media
  // counts for these sections may reflect ALL slides, not what's on-screen.
  function isCarouselEl(el) {
    return /swiper|slick|carousel|slider|owl-carousel|glide/i.test((el.className || '') + ' ' + (el.id || ''))
  }

  // Finds the "primary content wrapper" within a section: the section
  // itself if it's already a grid/flex container; otherwise prefer a
  // visible child that is ITSELF grid/flex (the real layout wrapper, e.g.
  // a `.list` grid sitting after a small title box); otherwise fall back
  // to the visible child with the most children (more likely the main
  // content area than e.g. a 2-child title+subtitle box).
  //
  // Carousel containers are excluded from child-drilling: their internal
  // structure (swiper-wrapper > slide > slide > ...) with transform-shifted
  // slides makes "biggest child" heuristics unreliable, and carousels are
  // almost always intentionally full-bleed anyway.
  // Duck-typed rather than `instanceof Element` — live commercial sites run
  // third-party scripts (ads, chat widgets, personalization) that can mutate
  // the DOM mid-extraction or inject nodes from another realm/context; an
  // `instanceof` check can spuriously fail there even for a real element.
  function looksLikeElement(x) {
    return !!x && typeof x.getBoundingClientRect === 'function' && typeof x.children !== 'undefined'
  }

  function findPrimaryWrapper(section) {
    try {
      if (isCarouselEl(section)) return section
      const csSection = getComputedStyle(section)
      if (csSection.display === 'grid' || csSection.display === 'flex') return section
      const children = [...section.children].filter((c) => looksLikeElement(c) && isVisible(c))
      if (children.length === 0) return section
      const gridOrFlexChild = children.find((c) => {
        const d = getComputedStyle(c).display
        return d === 'grid' || d === 'flex'
      })
      if (gridOrFlexChild && looksLikeElement(gridOrFlexChild)) return gridOrFlexChild
      const reduced = children.reduce((best, c) => (c.children.length > best.children.length ? c : best), children[0])
      return looksLikeElement(reduced) ? reduced : section
    } catch {
      return section
    }
  }

  function layoutOf(section) {
    const wrapper = findPrimaryWrapper(section)
    const cs = safeCS(wrapper) || { display: 'block', gap: null, columnGap: null }
    const gap = cs.gap && cs.gap !== 'normal' ? cs.gap : cs.columnGap || null

    let columns = 1
    let trackWidths = null
    if (cs.display === 'grid') {
      const tracks = splitTracks(cs.gridTemplateColumns || '').filter((t) => t && t !== 'none')
      if (tracks.length > 1) {
        columns = tracks.length
        trackWidths = tracks.map((t) => Math.round(parseFloat(t))).filter((n) => !Number.isNaN(n))
      }
    } else if (cs.display === 'flex' && (cs.flexDirection === 'row' || cs.flexDirection === 'row-reverse')) {
      const visibleChildren = [...wrapper.children].filter(isVisible)
      if (visibleChildren.length > 1) columns = visibleChildren.length
    }

    return {
      display: cs.display,
      columns,
      trackWidths,
      gap,
    }
  }

  function fullBleedInfo(section) {
    const wrapper = findPrimaryWrapper(section)
    const r = safeRect(wrapper) || safeRect(section) || { width: 0 }
    const contentWidth = Math.round(r.width)
    const fullBleed = contentWidth >= VIEWPORT_W - 40
    return { fullBleed, contentWidthPx: contentWidth }
  }

  // ---- identify header/nav/footer, exclude them from section walk --------
  const headerEl = document.querySelector('header')
  const footerEl = document.querySelector('footer')

  // Many sites don't use a semantic <nav> tag at all (menu is a plain
  // <ul>/<div> inside <header>). Fall back to the <ul> with the most
  // <li> > <a> children found inside the header (or whole doc if no
  // header), which generalizes across markup conventions.
  function findNavContainer() {
    const explicit = document.querySelector('nav')
    if (explicit) return explicit
    const scope = headerEl || document.body
    const uls = [...scope.querySelectorAll('ul')]
    let best = null
    let bestCount = 0
    uls.forEach((ul) => {
      // Only count VISIBLE, on-screen li>a — otherwise an off-canvas mobile
      // drawer menu (often has more, flattened items) wins over the real
      // on-screen desktop nav just because it has a larger raw DOM count.
      const liLinks = [...ul.children].filter(
        (li) => li.tagName === 'LI' && li.querySelector('a') && isVisible(li),
      )
      if (liLinks.length > bestCount) {
        bestCount = liLinks.length
        best = ul
      }
    })
    return best || headerEl
  }
  const navEl = findNavContainer()

  // ---- find the sections root: prefer <main>, else descend through
  // single-child wrapper divs (common in SPA frameworks: #__next, #root) ---
  function findSectionsRoot() {
    const main = document.querySelector('main')
    if (main) return main
    let el = document.body
    const skipTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'])
    for (let i = 0; i < 8; i++) {
      const kids = [...el.children].filter((c) => !skipTags.has(c.tagName))
      if (kids.length === 1) {
        el = kids[0]
        continue
      }
      break
    }
    return el
  }
  const sectionsRoot = findSectionsRoot()

  const excluded = new Set([headerEl, navEl, footerEl].filter(Boolean))
  const sections = []
  let idx = 0
  ;[...sectionsRoot.children].forEach((child) => {
    // A single section on a live, third-party-script-laden page shouldn't be
    // able to take down the whole extraction run — record a minimal
    // fallback entry and move on rather than throwing.
    try {
      if (excluded.has(child)) return
      if (!isVisible(child)) return
      const r = child.getBoundingClientRect()
      if (r.height < 120) return
      idx++
      const bbox = { y: Math.round(r.top + window.scrollY), height: Math.round(r.height) }
      const { fullBleed, contentWidthPx } = fullBleedInfo(child)
      const isCarousel = isCarouselEl(child)
      sections.push({
        index: idx,
        tag: child.tagName.toLowerCase(),
        bbox,
        background: findBackground(child),
        fullBleed,
        contentWidthPx,
        viewportWidthPx: VIEWPORT_W,
        carouselLikely: isCarousel,
        layout: layoutOf(child),
        media: (() => {
          const items = collectMedia(child, r)
          return { count: items.length, items }
        })(),
        text: textArchitecture(child),
      })
    } catch (err) {
      idx++
      let r = null
      try {
        r = child.getBoundingClientRect()
      } catch {
        // ignore
      }
      sections.push({
        index: idx,
        tag: child.tagName ? child.tagName.toLowerCase() : 'unknown',
        bbox: r ? { y: Math.round(r.top + window.scrollY), height: Math.round(r.height) } : { y: null, height: null },
        error: `extraction failed: ${err && err.message ? err.message : String(err)}`,
      })
    }
  })

  // ---- nav ----------------------------------------------------------------
  function navInfo() {
    if (!navEl) return null
    const cs = safeCS(navEl) || {}
    const headerCs = headerEl ? safeCS(headerEl) : null
    const sticky =
      cs.position === 'sticky' ||
      cs.position === 'fixed' ||
      (headerCs && (headerCs.position === 'sticky' || headerCs.position === 'fixed'))

    // Top-level items: <li> children if navEl is a <ul>, else visible <a>
    // that are direct-ish (not buried inside a hidden submenu — isVisible
    // already filters those out since hidden submenus collapse to 0x0).
    let topItems
    if (navEl.tagName === 'UL') {
      topItems = [...navEl.children].filter((li) => li.tagName === 'LI' && isVisible(li))
    } else {
      topItems = [...navEl.querySelectorAll('a')].filter(isVisible)
    }
    const itemCount = topItems.length

    // Mega-menu vs simple dropdown vs flat: measured generically by how many
    // extra links are nested inside each top-level item (not tied to any
    // site's specific class-naming convention).
    let maxNestedLinks = 0
    topItems.forEach((item) => {
      const linksInside = item.querySelectorAll('a').length
      maxNestedLinks = Math.max(maxNestedLinks, Math.max(0, linksInside - 1))
    })
    const megaMenu = maxNestedLinks > 6
    const hasDropdowns = maxNestedLinks > 0

    // topbar: a thin strip above/beside the nav row inside <header>, distinct from nav itself
    let topbar = false
    if (headerEl) {
      const headerChildren = [...headerEl.children].filter((c) => c !== navEl && isVisible(c))
      topbar = headerChildren.some((c) => {
        const cr = safeRect(c)
        return cr && cr.height > 0 && cr.height < 50 && cr.width > 200
      })
    }
    const tier = megaMenu ? 'mega-menu' : hasDropdowns ? 'dropdown' : topbar ? 'topbar+nav' : 'flat'
    return { itemCount, tier, sticky, megaMenu, hasDropdowns, topbar }
  }

  // ---- footer ---------------------------------------------------------------
  function footerInfo() {
    if (!footerEl) return null
    const links = [...footerEl.querySelectorAll('a')].filter(isVisible)

    // Find the real "row of columns": the container whose children each
    // look like a distinct column cluster (title + a list of items — i.e.
    // >=2 nested links/headings apiece), not a single leaf link. Searching
    // all descendants and taking the widest such match handles footers
    // with stacked bands (e.g. a social-icon strip above the real column
    // area, a copyright bar below) without being fooled by drilling too
    // shallow (band-level, undercounts) or by one column's own <ul> of
    // single-link <li>s (leaf-level, overcounts).
    let bestCandidates = []
    const containers = [footerEl, ...footerEl.querySelectorAll('*')]
    containers.forEach((el) => {
      if (!isVisible(el)) return
      const kids = [...el.children].filter((c) => {
        if (!isVisible(c)) return false
        const r = safeRect(c)
        if (!r || r.width <= 30 || r.height <= 15) return false
        return c.querySelectorAll('a, h1, h2, h3, h4, h5, h6').length >= 2
      })
      if (kids.length > bestCandidates.length) bestCandidates = kids
    })

    const cs = safeCS(footerEl) || {}
    const sticky = cs.position === 'sticky' || cs.position === 'fixed'
    return {
      itemCount: links.length,
      columnCount: bestCandidates.length,
      tier: bestCandidates.length >= 2 ? 'multi-column' : 'single-block',
      sticky,
    }
  }

  // ---- tokens ---------------------------------------------------------------
  function tokens() {
    // First VISIBLE, non-empty match only — avoids picking up hidden
    // utility/SEO markup (e.g. a visually-hidden h3 form label) that
    // happens to be first in DOM order.
    function firstVisibleWithText(sel) {
      return [...document.querySelectorAll(sel)].find(
        (el) => isVisible(el) && el.textContent && el.textContent.trim().length > 0,
      )
    }

    const fontSet = new Set()
    ;['body', 'h1', 'h2', 'h3', 'p'].forEach((sel) => {
      const el = firstVisibleWithText(sel) || document.querySelector(sel)
      const cs = el && safeCS(el)
      if (cs) fontSet.add(cs.fontFamily)
    })

    const h1 = firstVisibleWithText('h1')
    const h2 = firstVisibleWithText('h2')
    const h3 = firstVisibleWithText('h3')
    const headingSizes = {
      h1: h1 ? safeCS(h1)?.fontSize ?? null : null,
      h2: h2 ? safeCS(h2)?.fontSize ?? null : null,
      h3: h3 ? safeCS(h3)?.fontSize ?? null : null,
    }

    // Body text size: many sites don't use a single representative <p>, and
    // the DOM-first <p> is sometimes a large styled headline (e.g. a hero
    // slide title marked up as <p class="font">). Use the MODE across all
    // visible, non-empty <p> font-size/line-height pairs instead of the
    // first match — much more representative of actual body copy.
    const bodySizeTally = new Map()
    document.querySelectorAll('p').forEach((el) => {
      if (!isVisible(el)) return
      if (!el.textContent || !el.textContent.trim()) return
      const cs = safeCS(el)
      if (!cs) return
      const key = `${cs.fontSize}|${cs.lineHeight}`
      bodySizeTally.set(key, (bodySizeTally.get(key) || 0) + 1)
    })
    let body
    if (bodySizeTally.size > 0) {
      const [topKey] = [...bodySizeTally.entries()].sort((a, b) => b[1] - a[1])[0]
      const [fontSize, lineHeight] = topKey.split('|')
      body = { fontSize, lineHeight }
    } else {
      const bodyCs = safeCS(document.body)
      body = { fontSize: bodyCs?.fontSize ?? null, lineHeight: bodyCs?.lineHeight ?? null }
    }

    // color frequency across a bounded sample of elements (perf guard)
    const colorTally = new Map()
    const allEls = [...document.querySelectorAll('*')].slice(0, 4000)
    allEls.forEach((el) => {
      const cs = safeCS(el)
      if (!cs) return
      const bg = rgbToHex(cs.backgroundColor)
      if (bg) colorTally.set(bg, (colorTally.get(bg) || 0) + 1)
      const fg = rgbToHex(cs.color)
      if (fg) colorTally.set(fg, (colorTally.get(fg) || 0) + 1)
    })
    const colors = [...colorTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([hex, count]) => ({ hex, count }))

    // container max-width: tally maxWidth on likely wrapper elements
    const maxWidthTally = new Map()
    document.querySelectorAll('[class*="container" i], [class*="wrapper" i], [class*="content" i]').forEach((el) => {
      const cs = safeCS(el)
      if (!cs) return
      const mw = parseFloat(cs.maxWidth)
      if (!Number.isNaN(mw) && mw > 600 && mw < 3000) {
        maxWidthTally.set(mw, (maxWidthTally.get(mw) || 0) + 1)
      }
    })
    const containerMaxWidth =
      [...maxWidthTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // border-radius on button/card-like elements
    const radiusTally = new Map()
    let sampledButtons = 0
    document
      .querySelectorAll('button, a[class*="btn" i], a[class*="button" i], [role="button"], [class*="card" i]')
      .forEach((el) => {
        if (!isVisible(el)) return
        const r = safeRect(el)
        if (!r || r.width < 20 || r.height < 10) return
        sampledButtons++
        const cs = safeCS(el)
        if (!cs) return
        const rad = cs.borderTopLeftRadius
        if (rad && rad !== '0px') radiusTally.set(rad, (radiusTally.get(rad) || 0) + 1)
      })
    const borderRadius = [...radiusTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value]) => value)

    return {
      fontFamilies: [...fontSet],
      headingSizes,
      body,
      colors,
      containerMaxWidth: containerMaxWidth ? `${containerMaxWidth}px` : null,
      borderRadius,
      borderRadiusSampleCount: sampledButtons,
    }
  }

  // Same defensive posture as the section loop: nav/footer/tokens each
  // touch broad swaths of a live, third-party-script-laden page, so one
  // unexpected failure there shouldn't blank out everything else.
  function safely(fn, label) {
    try {
      return fn()
    } catch (err) {
      return { error: `${label} extraction failed: ${err && err.message ? err.message : String(err)}` }
    }
  }

  return {
    sections,
    nav: safely(navInfo, 'nav'),
    footer: safely(footerInfo, 'footer'),
    tokens: safely(tokens, 'tokens'),
  }
}
/* eslint-enable no-undef */

// ---------------------------------------------------------------------------
// Browser orchestration
// ---------------------------------------------------------------------------

async function dismissModals(page) {
  for (const sel of MODAL_DISMISS_SELECTORS) {
    try {
      const loc = page.locator(sel).first()
      if (await loc.isVisible({ timeout: 800 })) {
        await loc.click({ timeout: 1000 })
        await page.waitForTimeout(300)
        return sel
      }
    } catch {
      // best-effort, never hang
    }
  }
  return null
}

async function scrollFullPage(page) {
  await page.evaluate(async () => {
    const step = 600
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 150))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(400)
}

async function isBotWalled(page) {
  const info = await page.evaluate(() => ({
    title: document.title,
    bodyLen: (document.body.innerText || '').length,
  }))
  const t = (info.title || '').toLowerCase()
  return (
    t.includes('access denied') ||
    t.includes('attention required') ||
    t.includes('just a moment') ||
    t.includes('are you human') ||
    info.bodyLen < 80
  )
}

async function newContextAndPage(browser, viewport) {
  const context = await browser.newContext({ viewport, userAgent: DESKTOP_UA })
  const page = await context.newPage()
  return { context, page }
}

async function runOnce(browser, targetUrl) {
  const meta = { headlessFallbackUsed: false, modalDismissedSelector: null }

  const { context: dctx, page: dpage } = await newContextAndPage(browser, DESKTOP_VIEWPORT)
  await dpage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await dpage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  meta.modalDismissedSelector = await dismissModals(dpage)
  await scrollFullPage(dpage)

  const walled = await isBotWalled(dpage)
  if (walled) {
    await dctx.close()
    return { walled: true }
  }

  await dpage.screenshot({ path: path.join(OUT_DIR, 'home-desktop-full.jpeg'), fullPage: true, type: 'jpeg', quality: 82 })
  const extracted = await dpage.evaluate(extractInBrowser)
  await dctx.close()

  const { context: mctx, page: mpage } = await newContextAndPage(browser, MOBILE_VIEWPORT)
  await mpage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await mpage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await dismissModals(mpage)
  await scrollFullPage(mpage)
  await mpage.screenshot({ path: path.join(OUT_DIR, 'home-mobile-full.jpeg'), fullPage: true, type: 'jpeg', quality: 82 })
  await mctx.close()

  return { walled: false, extracted, meta }
}

let browser = await chromium.launch({ headless: true })
let result = await runOnce(browser, url)
let headlessFallbackUsed = false

if (result.walled) {
  console.warn('[wireframe-extract] Headless run looked bot-walled; retrying headed (headless: false)...')
  await browser.close()
  headlessFallbackUsed = true
  try {
    browser = await chromium.launch({ headless: false })
    result = await runOnce(browser, url)
  } catch (err) {
    console.error('[wireframe-extract] Headed fallback failed:', err.message)
  }
}

if (result.walled || !result.extracted) {
  console.error('[wireframe-extract] Could not extract — page appears blocked even after fallback.')
  await browser.close()
  process.exit(1)
}

result.meta.headlessFallbackUsed = headlessFallbackUsed
await browser.close()

// ---------------------------------------------------------------------------
// Write JSON outputs
// ---------------------------------------------------------------------------

const capturedAt = new Date().toISOString()
const wireframeJson = {
  meta: {
    url,
    slug,
    capturedAt,
    desktopViewport: DESKTOP_VIEWPORT,
    mobileViewport: MOBILE_VIEWPORT,
    headlessFallbackUsed: result.meta.headlessFallbackUsed,
    modalDismissedSelector: result.meta.modalDismissedSelector,
  },
  sections: result.extracted.sections,
  nav: result.extracted.nav,
  footer: result.extracted.footer,
}

const tokensJson = {
  meta: { url, slug, capturedAt },
  ...result.extracted.tokens,
}

await writeFile(path.join(OUT_DIR, 'wireframe.json'), JSON.stringify(wireframeJson, null, 2))
await writeFile(path.join(OUT_DIR, 'tokens.json'), JSON.stringify(tokensJson, null, 2))

// ---------------------------------------------------------------------------
// Generate WIREFRAME.md
// ---------------------------------------------------------------------------

function fmtLayout(section) {
  const l = section.layout
  if (l.display === 'grid' && l.columns > 1) {
    let ratio = ''
    if (l.trackWidths && l.trackWidths.length === 2) {
      const total = l.trackWidths[0] + l.trackWidths[1]
      if (total > 0) {
        const pctA = Math.round((l.trackWidths[0] / total) * 100)
        ratio = ` (${pctA}/${100 - pctA})`
      }
    }
    return `${l.columns}-col grid${ratio}`
  }
  if (l.display === 'flex' && l.columns > 1) return `${l.columns}-col flex row`
  if (l.display === 'grid' || l.display === 'flex') return `1-col ${l.display}`
  return 'block/stacked'
}

function fmtMedia(section) {
  const m = section.media
  if (m.count === 0) return null
  const videoCount = m.items.filter((it) => it.type === 'video').length
  const mediaWord = (n) => (videoCount === n ? 'video' : videoCount > 0 ? 'media' : 'image')
  if (m.count === 1) {
    const it = m.items[0]
    return `1 ${it.sizeBucket}-size ${it.type} ${it.position}`
  }
  const buckets = {}
  m.items.forEach((it) => {
    buckets[it.sizeBucket] = (buckets[it.sizeBucket] || 0) + 1
  })
  const bucketStr = Object.entries(buckets)
    .map(([b, n]) => `${n} ${b}`)
    .join(', ')
  return `${m.count} ${mediaWord(m.count)}${m.count === 1 ? '' : 's'} (${bucketStr})`
}

function fmtText(section) {
  const t = section.text
  const parts = []
  if (t.headings.length) {
    const topHeading = t.headings[0]
    const tag = topHeading.semantic === false ? 'title' : `h${topHeading.level}`
    parts.push(`${tag}${t.headings.length > 1 ? ` +${t.headings.length - 1} more` : ''}`)
  }
  if (t.paragraphCount) parts.push(`${t.paragraphCount} paragraph${t.paragraphCount === 1 ? '' : 's'}`)
  parts.push(`${t.density}-density`)
  if (t.ctaCount) parts.push(`${t.ctaCount} CTA${t.ctaCount === 1 ? '' : 's'}`)
  return parts.join(' ')
}

function sectionLine(section) {
  const bits = [
    `S${section.index}`,
    section.fullBleed ? 'full-bleed' : 'contained',
    fmtLayout(section),
  ]
  const media = fmtMedia(section)
  if (media) bits.push(media)
  bits.push(fmtText(section))
  bits.push(`bg ${section.background}`)
  const line = `**S${section.index}** · ${bits.slice(1).join(' · ')}`
  const headingLabels = section.text.headings
    .map((h) => `${h.semantic === false ? 'title(non-semantic)' : `h${h.level}`} "${h.label}"`)
    .join(', ')
  return { line, headingLabels }
}

const lines = []
lines.push(`# Wireframe blueprint — ${slug}`)
lines.push('')
lines.push(`Source: ${url}`)
lines.push(`Captured: ${capturedAt}`)
if (result.meta.headlessFallbackUsed) lines.push('Note: headless run was bot-walled; re-captured with a headed browser.')
if (result.meta.modalDismissedSelector) lines.push(`Note: dismissed an overlay/modal via selector \`${result.meta.modalDismissedSelector}\`.`)
lines.push('')
lines.push(`Structure only — no copy, images, or brand assets from the reference are captured. Heading labels below are truncated to ≤30 chars for section identification only.`)
lines.push('')
lines.push('## Sections')
lines.push('')

for (const section of wireframeJson.sections) {
  if (section.error) {
    lines.push(`- **S${section.index}** · extraction failed for this section (${section.error})`)
    lines.push(`  - y: ${section.bbox.y ?? 'unknown'}px, height: ${section.bbox.height ?? 'unknown'}px`)
    continue
  }
  const { line, headingLabels } = sectionLine(section)
  lines.push(`- ${line}`)
  if (headingLabels) lines.push(`  - headings: ${headingLabels}`)
  lines.push(`  - y: ${section.bbox.y}px, height: ${section.bbox.height}px, content width: ${section.contentWidthPx}px / viewport ${section.viewportWidthPx}px`)
  if (section.carouselLikely) {
    lines.push(`  - note: carousel/slider container — heading/paragraph/CTA/media counts may include multiple or duplicated slides in the DOM, not one on-screen view`)
  }
}

lines.push('')
lines.push('## Navigation')
lines.push('')
if (wireframeJson.nav && !wireframeJson.nav.error) {
  const n = wireframeJson.nav
  lines.push(`- ${n.itemCount} nav items · tier: ${n.tier} · sticky: ${n.sticky} · mega-menu: ${n.megaMenu} · has-dropdowns: ${n.hasDropdowns} · topbar: ${n.topbar}`)
} else if (wireframeJson.nav && wireframeJson.nav.error) {
  lines.push(`- Nav extraction failed: ${wireframeJson.nav.error}`)
} else {
  lines.push('- No `<nav>`/`<header>` element detected.')
}

lines.push('')
lines.push('## Footer')
lines.push('')
if (wireframeJson.footer && !wireframeJson.footer.error) {
  const f = wireframeJson.footer
  lines.push(`- ${f.itemCount} links · ${f.columnCount} columns · tier: ${f.tier} · sticky: ${f.sticky}`)
} else if (wireframeJson.footer && wireframeJson.footer.error) {
  lines.push(`- Footer extraction failed: ${wireframeJson.footer.error}`)
} else {
  lines.push('- No `<footer>` element detected.')
}

lines.push('')
lines.push('## Design tokens')
lines.push('')
const tk = tokensJson
if (tk.error) {
  lines.push(`- Token extraction failed: ${tk.error}`)
} else {
  lines.push(`- Font families: ${(tk.fontFamilies || []).join(' | ') || 'none detected'}`)
  lines.push(`- Heading sizes (desktop): h1 ${tk.headingSizes?.h1 ?? 'n/a'}, h2 ${tk.headingSizes?.h2 ?? 'n/a'}, h3 ${tk.headingSizes?.h3 ?? 'n/a'}`)
  lines.push(`- Body: ${tk.body?.fontSize ?? 'n/a'} / line-height ${tk.body?.lineHeight ?? 'n/a'}`)
  lines.push(`- Container max-width: ${tk.containerMaxWidth ?? 'not detected'}`)
  lines.push(
    `- Border-radius values seen: ${
      (tk.borderRadius || []).length
        ? tk.borderRadius.join(', ')
        : tk.borderRadiusSampleCount > 0
          ? `none — all ${tk.borderRadiusSampleCount} sampled buttons/cards are square-cornered (0px)`
          : 'not detected (no button/card-like elements sampled)'
    }`,
  )
  lines.push(`- Top colors: ${(tk.colors || []).map((c) => `${c.hex} (~${c.count})`).join(', ')}`)
}
lines.push('')

await writeFile(path.join(OUT_DIR, 'WIREFRAME.md'), lines.join('\n'))

console.log(`[wireframe-extract] Wrote ${OUT_DIR}/ — ${wireframeJson.sections.length} sections, headlessFallback=${result.meta.headlessFallbackUsed}`)
