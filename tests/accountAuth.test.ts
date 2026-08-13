import { describe, it, expect } from 'vitest'
import { renderAuthSection } from '../src/accountAuth'

describe('renderAuthSection', () => {
  it('renders a signup form with name, whatsapp, and password fields', () => {
    const html = renderAuthSection()
    expect(html).toContain('id="signup-form"')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="whatsappNumber"')
    expect(html).toContain('name="password"')
  })

  it('renders a login form with identifier and password fields', () => {
    const html = renderAuthSection()
    expect(html).toContain('id="login-form"')
    expect(html).toContain('name="identifier"')
  })

  it('renders a logged-in-state container for JS to fill in after checking /api/auth/me', () => {
    const html = renderAuthSection()
    expect(html).toContain('id="account-auth"')
  })
})
