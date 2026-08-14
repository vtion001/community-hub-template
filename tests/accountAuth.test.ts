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
