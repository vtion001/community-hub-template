import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { pool } from './db.ts'
import { authRouter } from './auth/routes.ts'
import { adminRouter } from './admin/routes.ts'
import { renderAdminPage } from './admin/page.ts'
import { createSessionMiddleware } from './session.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', process.env.DIST_DIR ?? 'dist')
// BASE_PATH lets one Express app serve under a URL prefix (e.g. a Tailscale
// Funnel path-mount at /sig-espresso) without changing behavior when unset -
// production and local dev both leave this empty and mount at root.
const basePath = process.env.BASE_PATH ?? ''

const app = express()
// Render terminates TLS at its edge and forwards over plain HTTP internally.
// Without trusting the proxy, Express's req.secure is always false, so
// express-session's secure cookie option silently drops every Set-Cookie
// header in production - this must be set before the session middleware.
app.set('trust proxy', 1)
app.use(express.json())
app.use(createSessionMiddleware())

const router = express.Router()

router.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Health check failed:', err)
    res.status(500).json({ ok: false })
  }
})

router.use('/api/auth', authRouter)
router.use('/api/admin', adminRouter)

router.get('/admin', (_req, res) => {
  res.type('html').send(renderAdminPage())
})

router.use(express.static(distDir))

app.use(basePath || '/', router)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' })
  }
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
