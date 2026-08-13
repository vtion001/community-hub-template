import { Router } from 'express'
import bcrypt from 'bcrypt'
import { pool } from '../db.ts'
import { normalizePhone } from './normalizePhone.ts'
import { asyncHandler } from '../asyncHandler.ts'

const BCRYPT_COST = 12

export const authRouter = Router()

authRouter.post('/signup', asyncHandler(async (req, res) => {
  const { name, whatsappNumber, password } = req.body ?? {}
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof whatsappNumber !== 'string' ||
    typeof password !== 'string' ||
    password.length < 8
  ) {
    return res
      .status(400)
      .json({ error: 'name, whatsappNumber, and a password of at least 8 characters are required' })
  }

  const normalized = normalizePhone(whatsappNumber)
  if (!normalized) {
    return res.status(400).json({ error: 'invalid WhatsApp number' })
  }

  const rosterCheck = await pool.query('SELECT 1 FROM roster WHERE whatsapp_number = $1', [normalized])
  if (rosterCheck.rowCount === 0) {
    return res.status(403).json({ error: 'not on our member list yet — ping an admin' })
  }

  const existing = await pool.query('SELECT 1 FROM users WHERE whatsapp_number = $1', [normalized])
  if ((existing.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: 'an account with this WhatsApp number already exists' })
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    const result = await pool.query(
      `INSERT INTO users (role, name, whatsapp_number, password_hash)
       VALUES ('member', $1, $2, $3)
       RETURNING id, role, name`,
      [name.trim(), normalized, passwordHash]
    )
    const user = result.rows[0]
    return res.status(201).json({ id: user.id, role: user.role, name: user.name })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'an account with this WhatsApp number already exists' })
    }
    throw err
  }
}))
