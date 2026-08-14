import { pool } from '../../server/db.ts'

export async function resetDb(): Promise<void> {
  await pool.query('DELETE FROM users')
  await pool.query('DELETE FROM roster')
  await pool.query('DELETE FROM sessions')
}
