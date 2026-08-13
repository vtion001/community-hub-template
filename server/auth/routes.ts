import { Router } from 'express'
import bcrypt from 'bcrypt'
import { pool } from '../db.ts'
import { normalizePhone } from './normalizePhone.ts'
import { asyncHandler } from '../asyncHandler.ts'

const BCRYPT_COST = 12

export const authRouter = Router()

authRouter.post('/signup', asyncHandler(async (req, res, next) => {
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
    req.session.regenerate((err) => {
      if (err) return next(err)
      req.session.userId = user.id
      req.session.role = user.role
      req.session.save((err) => {
        if (err) return next(err)
        return res.status(201).json({ id: user.id, role: user.role, name: user.name })
      })
    })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'an account with this WhatsApp number already exists' })
    }
    throw err
  }
}))

authRouter.post('/login', asyncHandler(async (req, res, next) => {
  const { identifier, password } = req.body ?? {}
  if (typeof identifier !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'identifier and password are required' })
  }

  let result
  if (identifier.includes('@')) {
    result = await pool.query('SELECT * FROM users WHERE email = $1', [identifier.trim().toLowerCase()])
  } else {
    const normalized = normalizePhone(identifier)
    if (!normalized) {
      return res.status(401).json({ error: 'invalid credentials' })
    }
    result = await pool.query('SELECT * FROM users WHERE whatsapp_number = $1', [normalized])
  }

  const user = result.rows[0]
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' })
  }
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'invalid credentials' })
  }

  req.session.regenerate((err) => {
    if (err) return next(err)
    req.session.userId = user.id
    req.session.role = user.role
    req.session.save((err) => {
      if (err) return next(err)
      return res.json({ id: user.id, role: user.role, name: user.name })
    })
  })
}))

authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'failed to log out' })
    res.clearCookie('connect.sid')
    return res.status(204).end()
  })
})

authRouter.get('/me', asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'not logged in' })
  }
  const result = await pool.query('SELECT id, role, name FROM users WHERE id = $1', [req.session.userId])
  const user = result.rows[0]
  if (!user) {
    return res.status(401).json({ error: 'not logged in' })
  }
  return res.json(user)
}))
