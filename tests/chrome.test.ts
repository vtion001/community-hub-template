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

  it('renders a mobile nav disclosure with all nav items', () => {
    const html = renderHeader(site, 'events')
    expect(html).toContain('<details class="lg:hidden">')
    expect(html).toContain('<summary')
    const mobileNav = html.match(/<nav id="mobile-nav"[^>]*>[\s\S]*?<\/nav>/)![0]
    expect(mobileNav).toContain('Events')
    expect(mobileNav).toContain('Shop')
  })

  it('marks the active page in the mobile nav too', () => {
    const html = renderHeader(site, 'events')
    const mobileNav = html.match(/<nav id="mobile-nav"[^>]*>[\s\S]*?<\/nav>/)![0]
    const eventsLink = mobileNav.match(/<a href="\/events\.html"[^>]*>/)![0]
    expect(eventsLink).toContain('border-[var(--color-accent)]')
  })
})

describe('renderFooter', () => {
  it('renders the ticker text and brand short name', () => {
    const html = renderFooter(site)
    expect(html).toContain('128 members online now')
    expect(html).toContain('S&E')
  })
})
