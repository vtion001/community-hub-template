import bcrypt from 'bcrypt'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../db.ts'

const BCRYPT_COST = 12

export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required to seed the admin account')
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  await pool.query(
    `INSERT INTO users (role, name, email, password_hash)
     VALUES ('admin', 'Admin', $1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email.trim().toLowerCase(), passwordHash]
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedAdmin()
    .then(() => {
      console.log('Admin account seeded.')
      return pool.end()
    })
    .catch((err) => {
      console.error('Seeding admin failed:', err)
      process.exit(1)
    })
}
