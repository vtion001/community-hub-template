import pg from 'pg'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:test@localhost:5433/chub_test',
})

pool.on('error', (err) => console.error('Unexpected idle client error', err))
