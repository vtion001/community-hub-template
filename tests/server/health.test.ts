import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.ts'
import { migrate } from '../../server/db/migrate.ts'

beforeAll(async () => {
  await migrate()
})

describe('GET /api/health', () => {
  it('returns 200 and ok:true when the database is reachable', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
