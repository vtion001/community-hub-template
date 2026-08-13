import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'
import { app } from '../../server/index.ts'
import { pool } from '../../server/db.ts'
import { migrate } from '../../server/db/migrate.ts'
import { resetDb } from './testDb.ts'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  await resetDb()
  const passwordHash = await bcrypt.hash('adminpass123', 12)
  await pool.query(
    `INSERT INTO users (role, name, email, password_hash) VALUES ('admin', 'Admin', 'admin@example.com', $1)`,
    [passwordHash]
  )
})

describe('POST /api/auth/login', () => {
  it('logs the admin in with email + password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@example.com', password: 'adminpass123' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('admin')
  })

  it('rejects the wrong password with a generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@example.com', password: 'wrongpassword' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid credentials')
  })

  it('rejects an identifier that does not exist, with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'whatever1' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid credentials')
  })

  it('logs a member in with a WhatsApp number in any format', async () => {
    // Uses a distinct number from signup.test.ts's fixture data to avoid a
    // roster unique-constraint collision when vitest runs test files in parallel
    // against the shared test Postgres instance.
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639179876543'])
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09179876543', password: 'memberpass1' })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '9179876543', password: 'memberpass1' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('member')
  })
})

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns the logged-in user, then 401 after logout, in the same session', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ identifier: 'admin@example.com', password: 'adminpass123' })

    const meRes = await agent.get('/api/auth/me')
    expect(meRes.status).toBe(200)
    expect(meRes.body.role).toBe('admin')

    await agent.post('/api/auth/logout')
    const meAfterLogout = await agent.get('/api/auth/me')
    expect(meAfterLogout.status).toBe(401)
  })
})
