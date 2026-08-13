import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.ts'

describe('static frontend + admin page', () => {
  it('serves the built index.html at /', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Sig & Espresso')
  })

  it('serves the built events.html at /events.html', async () => {
    const res = await request(app).get('/events.html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Events')
  })

  it('does not fall back to index.html for an unknown path (this is a multi-page site, not an SPA)', async () => {
    const res = await request(app).get('/this-page-does-not-exist')
    expect(res.status).toBe(404)
  })

  it('serves a server-rendered /admin page, not part of the Vite build', async () => {
    const res = await request(app).get('/admin')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('Admin login')
  })
})
