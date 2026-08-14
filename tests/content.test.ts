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
