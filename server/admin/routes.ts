import { Router } from 'express'
import { pool } from '../db.ts'
import { normalizePhone } from '../auth/normalizePhone.ts'
import { requireAdmin } from './requireAdmin.ts'
import { asyncHandler } from '../asyncHandler.ts'

export const adminRouter = Router()

adminRouter.get('/roster', requireAdmin, asyncHandler(async (_req, res) => {
  const result = await pool.query('SELECT id, whatsapp_number, note, created_at FROM roster ORDER BY created_at DESC')
  return res.json(result.rows)
}))

adminRouter.post('/roster', requireAdmin, asyncHandler(async (req, res) => {
  const { numbers } = req.body ?? {}
  if (!Array.isArray(numbers)) {
    return res.status(400).json({ error: 'numbers must be an array of strings' })
  }
  let added = 0
  for (const raw of numbers) {
    if (typeof raw !== 'string') continue
    const normalized = normalizePhone(raw)
    if (!normalized) continue
    const result = await pool.query(
      'INSERT INTO roster (whatsapp_number) VALUES ($1) ON CONFLICT (whatsapp_number) DO NOTHING',
      [normalized]
    )
    added += result.rowCount ?? 0
  }
  return res.status(201).json({ added })
}))

adminRouter.delete('/roster/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(404).json({ error: 'not found' })
  }
  const result = await pool.query('DELETE FROM roster WHERE id = $1', [req.params.id])
  if ((result.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: 'not found' })
  }
  return res.status(204).end()
}))
