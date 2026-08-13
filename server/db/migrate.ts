import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../db.ts'

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    whatsapp_number TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number TEXT UNIQUE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMPTZ NOT NULL
  );`,
]

export async function migrate(): Promise<void> {
  for (const statement of STATEMENTS) {
    await pool.query(statement)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => {
      console.log('Migrations complete.')
      return pool.end()
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
