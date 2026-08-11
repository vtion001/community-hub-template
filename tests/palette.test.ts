import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8')
const svg = readFileSync(path.resolve(__dirname, '../public/images/hero-bg.svg'), 'utf8')

describe('cozy palette tokens', () => {
  it('uses the cream background token', () => {
    expect(css).toContain('#fbf3e7')
  })
  it('uses the coffee-brown text token', () => {
    expect(css).toContain('#4a342a')
  })
  it('uses the terracotta accent token', () => {
    expect(css).toContain('#d98255')
  })
  it('no longer references the old dark-ink background', () => {
    expect(css).not.toContain('#14151a')
  })
  it('no longer references the old amber accent', () => {
    expect(css).not.toContain('#ffb020')
  })
})

describe('hero illustration recolor', () => {
  it('no longer uses the near-white stroke meant for a dark background', () => {
    expect(svg).not.toContain('#F2F0EA')
  })
  it('uses a muted brown stroke that reads on a light background', () => {
    expect(svg).toContain('#4A342A')
  })
})
