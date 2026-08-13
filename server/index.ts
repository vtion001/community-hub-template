import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { pool } from './db.ts'
import { authRouter } from './auth/routes.ts'
import { createSessionMiddleware } from './session.ts'

const app = express()
app.use(express.json())
app.use(createSessionMiddleware())

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Health check failed:', err)
    res.status(500).json({ ok: false })
  }
})

app.use('/api/auth', authRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled route error:', err)
  res.status(500).json({ error: 'internal server error' })
})

const port = Number(process.env.PORT) || 3000

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
}

export { app }
