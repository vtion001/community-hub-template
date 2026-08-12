import { describe, it, expect } from 'vitest'
import { withBase } from '../src/basePath'

describe('withBase', () => {
  it('leaves absolute paths unchanged when BASE_URL is the default "/"', () => {
    expect(withBase('/events.html')).toBe('/events.html')
    expect(withBase('/images/logo.svg')).toBe('/images/logo.svg')
  })

  it('leaves external URLs untouched', () => {
    const external = 'https://chat.whatsapp.com/KlrOkzxEGnI3id7XVx7fNH?s=cl&p=i&ilr=4&amv=0'
    expect(withBase(external)).toBe(external)
  })

  it('leaves relative paths untouched', () => {
    expect(withBase('#events')).toBe('#events')
  })
})
