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
})

async function loginAsAdmin() {
  const passwordHash = await bcrypt.hash('adminpass123', 12)
  await pool.query(
    `INSERT INTO users (role, name, email, password_hash) VALUES ('admin', 'Admin', 'admin@example.com', $1)`,
    [passwordHash]
  )
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ identifier: 'admin@example.com', password: 'adminpass123' })
  return agent
}

async function loginAsMember() {
  await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
  const agent = request.agent(app)
  await agent
    .post('/api/auth/signup')
    .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'memberpass1' })
  return agent
}

describe('roster access control', () => {
  it('returns 401 for GET /api/admin/roster with no session', async () => {
    const res = await request(app).get('/api/admin/roster')
    expect(res.status).toBe(401)
  })

  it('returns 403 for a member session', async () => {
    const member = await loginAsMember()
    const res = await member.get('/api/admin/roster')
    expect(res.status).toBe(403)
  })
})

describe('roster CRUD as admin', () => {
  it('adds, lists, and deletes roster entries', async () => {
    const admin = await loginAsAdmin()

    const addRes = await admin
      .post('/api/admin/roster')
      .send({ numbers: ['09171234567', '+639181234567', 'not-a-number'] })
    expect(addRes.status).toBe(201)
    expect(addRes.body.added).toBe(2)

    const listRes = await admin.get('/api/admin/roster')
    expect(listRes.status).toBe(200)
    expect(listRes.body).toHaveLength(2)
    const numbers = listRes.body.map((r: { whatsapp_number: string }) => r.whatsapp_number)
    expect(numbers).toContain('+639171234567')
    expect(numbers).toContain('+639181234567')

    const idToDelete = listRes.body[0].id
    const deleteRes = await admin.delete(`/api/admin/roster/${idToDelete}`)
    expect(deleteRes.status).toBe(204)

    const listAfterDelete = await admin.get('/api/admin/roster')
    expect(listAfterDelete.body).toHaveLength(1)
  })

  it('ignores duplicate numbers on re-add without erroring', async () => {
    const admin = await loginAsAdmin()
    await admin.post('/api/admin/roster').send({ numbers: ['09171234567'] })
    const res = await admin.post('/api/admin/roster').send({ numbers: ['09171234567'] })
    expect(res.status).toBe(201)
    expect(res.body.added).toBe(0)
  })

  it('returns 404 deleting a well-formed but nonexistent id', async () => {
    const admin = await loginAsAdmin()
    const res = await admin.delete('/api/admin/roster/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })

  it('returns 404 deleting a malformed id', async () => {
    const admin = await loginAsAdmin()
    const res = await admin.delete('/api/admin/roster/not-a-uuid')
    expect(res.status).toBe(404)
  })
})
