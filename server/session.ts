import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { pool } from './db.ts'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    role?: 'admin' | 'member'
  }
}

const PgStore = connectPgSimple(session)

export function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('SESSION_SECRET must be set in production')
  }
  const resolvedSecret = secret ?? 'dev-only-secret-do-not-use-in-production'
  return session({
    store: new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false }),
    secret: resolvedSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
}
