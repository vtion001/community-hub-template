import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8')
const svg = readFileSync(path.resolve(__dirname, '../public/images/hero-bg.svg'), 'utf8')

function hexToRgb(hex: string) {
  const num = parseInt(hex.replace('#', ''), 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const [R, G, B] = [r, g, b].map((c) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(hex1: string, hex2: string) {
  const L1 = relLuminance(hexToRgb(hex1))
  const L2 = relLuminance(hexToRgb(hex2))
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (lighter + 0.05) / (darker + 0.05)
}

describe('cozy palette tokens', () => {
  it('uses the cream background token', () => {
    expect(css).toContain('#fbf3e7')
  })
  it('uses the coffee-brown text token', () => {
    expect(css).toContain('#4a342a')
  })
  it('uses the terracotta accent token', () => {
    expect(css).toContain('#e08f64')
  })
  it('uses the dark terracotta accent-text token', () => {
    expect(css).toContain('#b24333')
  })
  it('uses the darkened muted token', () => {
    expect(css).toContain('#7a6c61')
  })
  it('no longer references the old dark-ink background', () => {
    expect(css).not.toContain('#14151a')
  })
  it('no longer references the old amber accent', () => {
    expect(css).not.toContain('#ffb020')
  })
})

describe('palette WCAG AA contrast (4.5:1 for body-size text)', () => {
  it('muted text on bg clears 4.5:1', () => {
    expect(contrastRatio('#7a6c61', '#fbf3e7')).toBeGreaterThanOrEqual(4.5)
  })
  it('fg text on accent (button pattern) clears 4.5:1', () => {
    expect(contrastRatio('#4a342a', '#e08f64')).toBeGreaterThanOrEqual(4.5)
  })
  it('accent-text on bg (hero headline) clears 4.5:1', () => {
    expect(contrastRatio('#b24333', '#fbf3e7')).toBeGreaterThanOrEqual(4.5)
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
