import { describe, it, expect } from 'vitest'
import { renderAuthSection, type DashboardSection } from '../src/accountAuth'

const sections: DashboardSection[] = [
  { key: 'learn', title: 'Learn', blocks: [{ type: 'text', body: 'Learn body' }] },
  { key: 'resources', title: 'Resources', blocks: [{ type: 'text', body: 'Resources body' }] },
  { key: 'forum', title: 'Forum', blocks: [{ type: 'text', body: 'Forum body' }] },
]

describe('renderAuthSection', () => {
  it('renders a signup form with name, whatsapp, and password fields', () => {
    const html = renderAuthSection(sections)
    expect(html).toContain('id="signup-form"')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="whatsappNumber"')
    expect(html).toContain('name="password"')
  })

  it('renders a login form with identifier and password fields', () => {
    const html = renderAuthSection(sections)
    expect(html).toContain('id="login-form"')
    expect(html).toContain('name="identifier"')
  })

  it('renders a logged-in-state container for JS to fill in after checking /api/auth/me', () => {
    const html = renderAuthSection(sections)
    expect(html).toContain('id="account-auth"')
  })

  it('styles the guest forms panel as a bordered membership card', () => {
    const html = renderAuthSection(sections)
    const formsOpenTag = html.match(/<div id="account-auth-forms"[^>]*>/)?.[0] ?? ''
    expect(formsOpenTag).toContain('bg-[var(--color-panel)]')
    expect(formsOpenTag).toContain('border')
  })

  it('gives every password field a show/hide toggle', () => {
    const html = renderAuthSection(sections)
    const passwordFieldCount = (html.match(/type="password"/g) ?? []).length
    const toggleCount = (html.match(/account-toggle-password/g) ?? []).length
    expect(passwordFieldCount).toBe(2)
    expect(toggleCount).toBe(2)
  })

  it('renders every dashboard section title and content in the logged-in view', () => {
    const html = renderAuthSection(sections)
    for (const section of sections) {
      expect(html).toContain(section.title)
    }
    expect(html).toContain('Learn body')
    expect(html).toContain('Resources body')
    expect(html).toContain('Forum body')
  })
})
