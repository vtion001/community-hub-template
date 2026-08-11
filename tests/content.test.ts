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
