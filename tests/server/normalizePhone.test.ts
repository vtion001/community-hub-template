import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../../server/auth/normalizePhone.ts'

describe('normalizePhone', () => {
  it('normalizes a +63-prefixed number to itself', () => {
    expect(normalizePhone('+639171234567')).toBe('+639171234567')
  })

  it('normalizes a 0-prefixed local number', () => {
    expect(normalizePhone('09171234567')).toBe('+639171234567')
  })

  it('normalizes a bare 10-digit number', () => {
    expect(normalizePhone('9171234567')).toBe('+639171234567')
  })

  it('strips spaces and dashes before normalizing', () => {
    expect(normalizePhone('0917 123-4567')).toBe('+639171234567')
  })

  it('returns null for a number that is too short', () => {
    expect(normalizePhone('123')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull()
  })
})
