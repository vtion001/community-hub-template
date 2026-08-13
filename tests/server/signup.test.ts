import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.ts'
import { pool } from '../../server/db.ts'
import { migrate } from '../../server/db/migrate.ts'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  await pool.query('DELETE FROM users')
  await pool.query('DELETE FROM roster')
})

describe('POST /api/auth/signup', () => {
  it('rejects a WhatsApp number not on the roster', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' })
    expect(res.status).toBe(403)
  })

  it('creates a member when the WhatsApp number is on the roster', async () => {
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('member')
    expect(res.body.name).toBe('Ada')
  })

  it('rejects a duplicate WhatsApp number', async () => {
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' })
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada Two', whatsappNumber: '09171234567', password: 'correcthorse' })
    expect(res.status).toBe(409)
  })

  it('rejects a missing name, number, or a too-short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '', whatsappNumber: '09171234567', password: 'short' })
    expect(res.status).toBe(400)
  })

  it('rejects an unrecognizable WhatsApp number', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '123', password: 'correcthorse' })
    expect(res.status).toBe(400)
  })

  it('handles concurrent signups for the same number without hanging or 500ing', async () => {
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/signup').send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' }),
      request(app).post('/api/auth/signup').send({ name: 'Ada Two', whatsappNumber: '09171234567', password: 'correcthorse' }),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])
  })
})
