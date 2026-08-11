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
