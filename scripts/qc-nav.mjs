import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const site = JSON.parse(readFileSync(path.resolve(__dirname, '../content/site.json'), 'utf8'))

const BASE = process.argv[2] || 'http://127.0.0.1:4400'
const PAGE_PATHS = [
  '', 'events.html', 'shop.html', 'resources.html', 'forum.html',
  'blog.html', 'gallery.html', 'learn.html', 'about.html',
  'contribute.html', 'account.html',
]
const DESKTOP_NAV_SELECTOR = 'header nav#desktop-nav a'

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
const navCount = await page.locator(DESKTOP_NAV_SELECTOR).count()
console.log('nav link count:', navCount)

const expectedNavCount = site.nav.items.length
if (navCount !== expectedNavCount) {
  problems.push(`nav link count mismatch: expected ${expectedNavCount} (from content/site.json), got ${navCount}`)
}

for (let i = 0; i < navCount; i++) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const link = page.locator(DESKTOP_NAV_SELECTOR).nth(i)
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
