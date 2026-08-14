# Auth + Backend + Hosting Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal Express + Postgres backend alongside the existing static Vite frontend, giving the site real admin (1) and member (WhatsApp-roster-gated) accounts, deployed single-origin on Render.

**Architecture:** `server/` is a new Express app, written in TypeScript and run directly by Node (Node 22.6+ strips TS types natively — no build step, no `tsx`/`ts-node` dependency). It serves the existing Vite-built `dist/` for all static routes, exposes `/api/auth/*` and `/api/admin/*`, and a server-rendered `/admin` page. Postgres holds `users`, `roster`, and `sessions` (the last for `express-session` via `connect-pg-simple`). None of the existing 11 static pages, `src/chrome.ts`, `src/renderPage.ts`, or their tests change — this is additive except for `content/site.json`'s account intro copy and `src/pages/account.ts` (which gains the member login/signup UI).

**Tech Stack:** Express, `pg`, `bcrypt`, `express-session` + `connect-pg-simple`, Vitest + `supertest` (backend tests run in the existing `node`-environment Vitest config — no new test runner). Deployed to Render via the Render CLI (`D:\render-cli\render.exe`), staging environment created and verified before production.

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-08-14-auth-backend-foundation-design.md`.)

- Two roles only, one `users` table with a `role` column (`admin` | `member`) — not two parallel systems.
- Exactly one admin account, seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars — no public admin signup.
- Member signup requires the WhatsApp number to match an entry in `roster`, or it's rejected with `403`.
- Phone numbers are normalized to `+63XXXXXXXXXX` before every write and every comparison — `+639171234567`, `09171234567`, and `9171234567` must all normalize identically.
- Login `identifier` distinguishes admin vs. member by shape: contains `@` → email/admin lookup; otherwise → normalized-phone/member lookup.
- Security floor, not to be relaxed: bcrypt cost factor 12; session cookies `httpOnly`, `secure`, `sameSite: 'lax'`; 30-day sliding session TTL.
- No OAuth, no password reset flow, no rate limiting, no roster CSV import, no real roster/member data seeded by this work — all explicitly out of scope.
- Events themselves and a general content-editing CMS are explicitly deferred to future specs — this plan touches only auth/backend/hosting plus the minimal `account.html` UI needed to exercise it.
- Secret hygiene: never generate or type `ADMIN_PASSWORD`/`SESSION_SECRET`/DB passwords into a command or commit them — these are set by the human directly in the Render dashboard.

## Local test database (needed for every task below)

All backend tests run against a real ephemeral Postgres (not mocked), per the spec. Start it once, before Task 1:

```bash
docker run -d --name chub-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=chub_test -p 5433:5432 postgres:16
```

Every backend test file in this plan reads `process.env.DATABASE_URL`, defaulting to `postgresql://postgres:test@localhost:5433/chub_test` if unset — so `npm run test` works out of the box against this container with no `.env` setup required.

---

## Task 1: Server scaffolding — DB pool, migration, health check

**Files:**
- Create: `server/db.ts`
- Create: `server/db/migrate.ts`
- Create: `server/index.ts`
- Create: `.node-version`
- Modify: `package.json` (add dependencies, `engines`, scripts)
- Test: `tests/server/health.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `pool` (a `pg.Pool`, exported from `server/db.ts`) — every later task's DB access goes through this. `migrate()` (exported from `server/db/migrate.ts`) — creates `users`, `roster`, `sessions` tables, idempotent (`CREATE TABLE IF NOT EXISTS`). `app` (an Express `Express` instance, exported from `server/index.ts`, NOT auto-listening when imported) — every later task mounts routes onto this file, and `tests/server/*.test.ts` import `app` for `supertest`.

- [ ] **Step 1: Add dependencies and scripts to `package.json`**

Replace the full `package.json` with:

```json
{
  "name": "community-hub-template",
  "version": "1.0.0",
  "description": "Reusable community-site template (layout/structure extracted from a reference site; all copy, colors, and artwork are original).",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.6.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "qc": "node scripts/qc-nav.mjs",
    "server": "node --experimental-strip-types server/index.ts",
    "server:migrate": "node --experimental-strip-types server/db/migrate.ts",
    "server:seed-admin": "node --experimental-strip-types server/db/seedAdmin.ts"
  },
  "license": "ISC",
  "dependencies": {
    "bcrypt": "^5.1.1",
    "connect-pg-simple": "^10.0.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/bcrypt": "^5.0.2",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/pg": "^8.11.10",
    "@types/supertest": "^6.0.2",
    "playwright": "^1.62.1",
    "supertest": "^7.0.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2",
    "vite": "^8.2.1",
    "vitest": "^4.1.10"
  }
}
```

Run: `npm install`
Expected: installs cleanly, no errors.

- [ ] **Step 2: Pin the Node version for Render**

Create `.node-version`:

```
22.6.0
```

- [ ] **Step 3: Write `server/db.ts`**

```ts
import pg from 'pg'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:test@localhost:5433/chub_test',
})
```

- [ ] **Step 4: Write `server/db/migrate.ts`**

```ts
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
```

Run: `npm run server:migrate`
Expected: prints `Migrations complete.`, exits 0. (Requires the Docker test DB from the "Local test database" section above to be running, or a real `DATABASE_URL` exported.)

- [ ] **Step 5: Write `server/index.ts`**

```ts
import express from 'express'
import { pool } from './db.ts'

const app = express()
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false })
  }
})

const port = Number(process.env.PORT) || 3000

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
}

export { app }
```

- [ ] **Step 6: Write the failing test**

Create `tests/server/health.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.ts'
import { migrate } from '../../server/db/migrate.ts'

beforeAll(async () => {
  await migrate()
})

describe('GET /api/health', () => {
  it('returns 200 and ok:true when the database is reachable', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
```

Run: `npx vitest run tests/server/health.test.ts`
Expected: PASS (this test can't meaningfully "fail first" since Step 5 already wrote the passing implementation — that's fine here, Task 1 is scaffolding; TDD's failing-first discipline resumes in Task 2 with real business logic).

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `npm run test`
Expected: PASS — all existing frontend suites (5 files) plus the new `tests/server/health.test.ts` pass.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .node-version server/db.ts server/db/migrate.ts server/index.ts tests/server/health.test.ts
git commit -m "Add server scaffolding: DB pool, migration, health check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 2: Phone number normalization

**Files:**
- Create: `server/auth/normalizePhone.ts`
- Test: `tests/server/normalizePhone.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizePhone(input: string): string | null` — exported from `server/auth/normalizePhone.ts`. Returns the normalized `+63XXXXXXXXXX` form, or `null` if the input isn't a recognizable PH number. Task 3, 4, and 5 all import and use this exact function.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/normalizePhone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../../server/auth/normalizePhone.ts'

describe('normalizePhone', () => {
  it('normalizes a +63-prefixed number to itself', () => {
    expect(normalizePhone('+639171234567')).toBe('+639171234567')
  })

  it('normalizes a 0-prefixed local number', () => {
    expect(normalizePhone('09171234567')).toBe('+639171234567')
  })

  it('normalizes a bare 10-digit number', () => {
    expect(normalizePhone('9171234567')).toBe('+639171234567')
  })

  it('strips spaces and dashes before normalizing', () => {
    expect(normalizePhone('0917 123-4567')).toBe('+639171234567')
  })

  it('returns null for a number that is too short', () => {
    expect(normalizePhone('123')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/normalizePhone.test.ts`
Expected: FAIL — `server/auth/normalizePhone.ts` doesn't exist yet, import error.

- [ ] **Step 3: Write `server/auth/normalizePhone.ts`**

```ts
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+63${digits.slice(1)}`
  }
  if (digits.length === 10 && !digits.startsWith('0')) {
    return `+63${digits}`
  }
  if (digits.length === 12 && digits.startsWith('63')) {
    return `+${digits}`
  }
  return null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/server/normalizePhone.test.ts`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/auth/normalizePhone.ts tests/server/normalizePhone.test.ts
git commit -m "Add phone number normalization for PH numbers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 3: Signup endpoint + roster gating

**Files:**
- Create: `server/auth/routes.ts`
- Modify: `server/index.ts`
- Test: `tests/server/signup.test.ts`

**Interfaces:**
- Consumes: `pool` from `server/db.ts` (Task 1), `normalizePhone` from `server/auth/normalizePhone.ts` (Task 2).
- Produces: `authRouter` (an Express `Router`, exported from `server/auth/routes.ts`), mounted at `/api/auth` in `server/index.ts`. `POST /api/auth/signup` — later tasks (4) add more routes to this same router; this task only adds `/signup`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/signup.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.ts'
import { pool } from '../../server/db.ts'
import { migrate } from '../../server/db/migrate.ts'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  await pool.query('DELETE FROM users')
  await pool.query('DELETE FROM roster')
})

describe('POST /api/auth/signup', () => {
  it('rejects a WhatsApp number not on the roster', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' })
    expect(res.status).toBe(403)
  })

  it('creates a member when the WhatsApp number is on the roster', async () => {
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('member')
    expect(res.body.name).toBe('Ada')
  })

  it('rejects a duplicate WhatsApp number', async () => {
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'correcthorse' })
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada Two', whatsappNumber: '09171234567', password: 'correcthorse' })
    expect(res.status).toBe(409)
  })

  it('rejects a missing name, number, or a too-short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '', whatsappNumber: '09171234567', password: 'short' })
    expect(res.status).toBe(400)
  })

  it('rejects an unrecognizable WhatsApp number', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '123', password: 'correcthorse' })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/signup.test.ts`
Expected: FAIL — `/api/auth/signup` route doesn't exist yet (404 on all requests).

- [ ] **Step 3: Write `server/auth/routes.ts`**

```ts
import { Router } from 'express'
import bcrypt from 'bcrypt'
import { pool } from '../db.ts'
import { normalizePhone } from './normalizePhone.ts'

const BCRYPT_COST = 12

export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
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

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const result = await pool.query(
    `INSERT INTO users (role, name, whatsapp_number, password_hash)
     VALUES ('member', $1, $2, $3)
     RETURNING id, role, name`,
    [name.trim(), normalized, passwordHash]
  )
  const user = result.rows[0]
  return res.status(201).json({ id: user.id, role: user.role, name: user.name })
})
```

- [ ] **Step 4: Mount `authRouter` in `server/index.ts`**

In `server/index.ts`, add the import near the top:

```ts
import { authRouter } from './auth/routes.ts'
```

And mount it, after the `/api/health` route and before the `port`/`listen` block:

```ts
app.use('/api/auth', authRouter)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/server/signup.test.ts`
Expected: PASS — all 5 tests pass.

Run: `npm run test`
Expected: PASS — full suite, no regressions.

- [ ] **Step 6: Commit**

```bash
git add server/auth/routes.ts server/index.ts tests/server/signup.test.ts
git commit -m "Add signup endpoint with WhatsApp roster gating

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 4: Sessions, login, logout, /me

**Files:**
- Create: `server/session.ts`
- Modify: `server/auth/routes.ts`
- Modify: `server/index.ts`
- Test: `tests/server/auth.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 1), `normalizePhone` (Task 2), `authRouter` (Task 3, extended here).
- Produces: `createSessionMiddleware(): RequestHandler`, exported from `server/session.ts` — mounted once in `server/index.ts`, before any routers. `req.session.userId` / `req.session.role` become available on every request from this point forward — Task 5's `requireAdmin` middleware relies on `req.session.role`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'
import { app } from '../../server/index.ts'
import { pool } from '../../server/db.ts'
import { migrate } from '../../server/db/migrate.ts'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  await pool.query('DELETE FROM users')
  const passwordHash = await bcrypt.hash('adminpass123', 12)
  await pool.query(
    `INSERT INTO users (role, name, email, password_hash) VALUES ('admin', 'Admin', 'admin@example.com', $1)`,
    [passwordHash]
  )
})

describe('POST /api/auth/login', () => {
  it('logs the admin in with email + password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@example.com', password: 'adminpass123' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('admin')
  })

  it('rejects the wrong password with a generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@example.com', password: 'wrongpassword' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid credentials')
  })

  it('rejects an identifier that does not exist, with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'whatever1' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid credentials')
  })

  it('logs a member in with a WhatsApp number in any format', async () => {
    await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'memberpass1' })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '9171234567', password: 'memberpass1' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('member')
  })
})

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns the logged-in user, then 401 after logout, in the same session', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ identifier: 'admin@example.com', password: 'adminpass123' })

    const meRes = await agent.get('/api/auth/me')
    expect(meRes.status).toBe(200)
    expect(meRes.body.role).toBe('admin')

    await agent.post('/api/auth/logout')
    const meAfterLogout = await agent.get('/api/auth/me')
    expect(meAfterLogout.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/auth.test.ts`
Expected: FAIL — `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` don't exist yet.

- [ ] **Step 3: Write `server/session.ts`**

```ts
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
  const secret = process.env.SESSION_SECRET ?? 'dev-only-secret-do-not-use-in-production'
  return session({
    store: new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false }),
    secret,
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
```

Note: `secure` is conditional on `NODE_ENV === 'production'` here specifically so `supertest` (which talks to the app in-process over plain HTTP, not TLS) and local dev both work; Task 8's deployment sets `NODE_ENV=production` on Render, where TLS is always terminated for you, satisfying the spec's "secure in both staging and production" requirement.

- [ ] **Step 4: Add login/logout/me to `server/auth/routes.ts`**

Append these three routes to the end of `server/auth/routes.ts` (after the existing `/signup` route, same file):

```ts
authRouter.post('/login', async (req, res) => {
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

  req.session.userId = user.id
  req.session.role = user.role
  return res.json({ id: user.id, role: user.role, name: user.name })
})

authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'failed to log out' })
    res.clearCookie('connect.sid')
    return res.status(204).end()
  })
})

authRouter.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'not logged in' })
  }
  const result = await pool.query('SELECT id, role, name FROM users WHERE id = $1', [req.session.userId])
  const user = result.rows[0]
  if (!user) {
    return res.status(401).json({ error: 'not logged in' })
  }
  return res.json(user)
})
```

Also update the `/signup` route so it starts a session on success — insert this right before the `return res.status(201)...` line already in `/signup`:

```ts
  req.session.userId = user.id
  req.session.role = user.role
```

(So the full end of `/signup` reads: set `req.session.userId`/`role`, then `return res.status(201).json(...)`.)

- [ ] **Step 5: Wire the session middleware into `server/index.ts`**

In `server/index.ts`, add the import:

```ts
import { createSessionMiddleware } from './session.ts'
```

And add `app.use(createSessionMiddleware())` immediately after `app.use(express.json())` — session middleware must be registered before `authRouter` is mounted, since the routes now read/write `req.session`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/server/auth.test.ts`
Expected: PASS — all 6 tests pass.

Run: `npx vitest run tests/server/signup.test.ts`
Expected: PASS — still passes (signup now also sets a session, which the existing signup tests don't check for, so this is a non-breaking addition).

Run: `npm run test`
Expected: PASS — full suite.

- [ ] **Step 7: Commit**

```bash
git add server/session.ts server/auth/routes.ts server/index.ts tests/server/auth.test.ts
git commit -m "Add sessions, login, logout, and /me

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 5: Admin seed script + roster CRUD

**Files:**
- Create: `server/db/seedAdmin.ts`
- Create: `server/admin/requireAdmin.ts`
- Create: `server/admin/routes.ts`
- Modify: `server/index.ts`
- Test: `tests/server/roster.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 1), `normalizePhone` (Task 2), `req.session.role` (Task 4).
- Produces: `seedAdmin(): Promise<void>` (exported from `server/db/seedAdmin.ts`, run via `npm run server:seed-admin`, used again in Task 8's deploy). `requireAdmin` (an Express middleware, exported from `server/admin/requireAdmin.ts`). `adminRouter` (an Express `Router`, exported from `server/admin/routes.ts`), mounted at `/api/admin`.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/roster.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'
import { app } from '../../server/index.ts'
import { pool } from '../../server/db.ts'
import { migrate } from '../../server/db/migrate.ts'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  await pool.query('DELETE FROM roster')
  await pool.query('DELETE FROM users')
})

async function loginAsAdmin() {
  const passwordHash = await bcrypt.hash('adminpass123', 12)
  await pool.query(
    `INSERT INTO users (role, name, email, password_hash) VALUES ('admin', 'Admin', 'admin@example.com', $1)`,
    [passwordHash]
  )
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ identifier: 'admin@example.com', password: 'adminpass123' })
  return agent
}

async function loginAsMember() {
  await pool.query('INSERT INTO roster (whatsapp_number) VALUES ($1)', ['+639171234567'])
  const agent = request.agent(app)
  await agent
    .post('/api/auth/signup')
    .send({ name: 'Ada', whatsappNumber: '09171234567', password: 'memberpass1' })
  return agent
}

describe('roster access control', () => {
  it('returns 401 for GET /api/admin/roster with no session', async () => {
    const res = await request(app).get('/api/admin/roster')
    expect(res.status).toBe(401)
  })

  it('returns 403 for a member session', async () => {
    const member = await loginAsMember()
    const res = await member.get('/api/admin/roster')
    expect(res.status).toBe(403)
  })
})

describe('roster CRUD as admin', () => {
  it('adds, lists, and deletes roster entries', async () => {
    const admin = await loginAsAdmin()

    const addRes = await admin
      .post('/api/admin/roster')
      .send({ numbers: ['09171234567', '+639181234567', 'not-a-number'] })
    expect(addRes.status).toBe(201)
    expect(addRes.body.added).toBe(2)

    const listRes = await admin.get('/api/admin/roster')
    expect(listRes.status).toBe(200)
    expect(listRes.body).toHaveLength(2)
    const numbers = listRes.body.map((r: { whatsapp_number: string }) => r.whatsapp_number)
    expect(numbers).toContain('+639171234567')
    expect(numbers).toContain('+639181234567')

    const idToDelete = listRes.body[0].id
    const deleteRes = await admin.delete(`/api/admin/roster/${idToDelete}`)
    expect(deleteRes.status).toBe(204)

    const listAfterDelete = await admin.get('/api/admin/roster')
    expect(listAfterDelete.body).toHaveLength(1)
  })

  it('ignores duplicate numbers on re-add without erroring', async () => {
    const admin = await loginAsAdmin()
    await admin.post('/api/admin/roster').send({ numbers: ['09171234567'] })
    const res = await admin.post('/api/admin/roster').send({ numbers: ['09171234567'] })
    expect(res.status).toBe(201)
    expect(res.body.added).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/roster.test.ts`
Expected: FAIL — `/api/admin/roster` routes don't exist yet.

- [ ] **Step 3: Write `server/admin/requireAdmin.ts`**

```ts
import type { Request, Response, NextFunction } from 'express'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'not logged in' })
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' })
  }
  return next()
}
```

- [ ] **Step 4: Write `server/admin/routes.ts`**

```ts
import { Router } from 'express'
import { pool } from '../db.ts'
import { normalizePhone } from '../auth/normalizePhone.ts'
import { requireAdmin } from './requireAdmin.ts'

export const adminRouter = Router()

adminRouter.get('/roster', requireAdmin, async (_req, res) => {
  const result = await pool.query('SELECT id, whatsapp_number, note, created_at FROM roster ORDER BY created_at DESC')
  return res.json(result.rows)
})

adminRouter.post('/roster', requireAdmin, async (req, res) => {
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
})

adminRouter.delete('/roster/:id', requireAdmin, async (req, res) => {
  const result = await pool.query('DELETE FROM roster WHERE id = $1', [req.params.id])
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'not found' })
  }
  return res.status(204).end()
})
```

- [ ] **Step 5: Write `server/db/seedAdmin.ts`**

```ts
import bcrypt from 'bcrypt'
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
```

- [ ] **Step 6: Mount `adminRouter` in `server/index.ts`**

Add the import:

```ts
import { adminRouter } from './admin/routes.ts'
```

And mount it, right after `app.use('/api/auth', authRouter)`:

```ts
app.use('/api/admin', adminRouter)
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/server/roster.test.ts`
Expected: PASS — all 4 tests pass.

Run: `npm run test`
Expected: PASS — full suite, no regressions.

- [ ] **Step 8: Commit**

```bash
git add server/db/seedAdmin.ts server/admin/requireAdmin.ts server/admin/routes.ts server/index.ts tests/server/roster.test.ts
git commit -m "Add admin seed script and roster CRUD

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 6: Static serving, /admin page, Vite dev proxy

**Files:**
- Create: `server/admin/page.ts`
- Modify: `server/index.ts`
- Modify: `vite.config.ts`
- Test: `tests/server/staticAndAdmin.test.ts`

**Interfaces:**
- Consumes: `authRouter`, `adminRouter` (Tasks 3-5), `pool`.
- Produces: the fully wired `app` — this is the last backend task; every route the previous tasks built is now reachable end-to-end through one Express instance that also serves the built frontend.

- [ ] **Step 1: Build the frontend once, so `dist/` exists for this task's tests**

Run: `npm run build`
Expected: succeeds, `dist/index.html` and the other 10 HTML entries exist.

- [ ] **Step 2: Write the failing test**

Create `tests/server/staticAndAdmin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.ts'

describe('static frontend + admin page', () => {
  it('serves the built index.html at /', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Sig & Espresso')
  })

  it('serves the built events.html at /events.html', async () => {
    const res = await request(app).get('/events.html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Events')
  })

  it('does not fall back to index.html for an unknown path (this is a multi-page site, not an SPA)', async () => {
    const res = await request(app).get('/this-page-does-not-exist')
    expect(res.status).toBe(404)
  })

  it('serves a server-rendered /admin page, not part of the Vite build', async () => {
    const res = await request(app).get('/admin')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('Admin login')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/server/staticAndAdmin.test.ts`
Expected: FAIL — `server/index.ts` doesn't serve `dist/` or `/admin` yet, so `/` and `/events.html` 404 and `/admin` 404s too.

- [ ] **Step 4: Write `server/admin/page.ts`**

```ts
export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Admin — Sig & Espresso</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; }
    input, button, textarea { font: inherit; padding: 8px; margin: 4px 0; width: 100%; box-sizing: border-box; }
    button { cursor: pointer; }
    #roster-list { list-style: none; padding: 0; }
    #roster-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #ddd; }
    .error { color: #b00; }
  </style>
</head>
<body>
  <div id="app">Loading…</div>
  <script>
    const app = document.getElementById('app')

    async function me() {
      const res = await fetch('/api/auth/me')
      return res.ok ? res.json() : null
    }

    function renderLogin() {
      app.innerHTML = \`
        <h1>Admin login</h1>
        <form id="login-form">
          <input name="identifier" type="email" placeholder="Admin email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Log in</button>
          <p class="error" id="login-error"></p>
        </form>
      \`
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const form = new FormData(e.target)
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }),
        })
        if (res.ok) return boot()
        document.getElementById('login-error').textContent = 'Login failed.'
      })
    }

    async function renderRoster() {
      const res = await fetch('/api/admin/roster')
      const roster = res.ok ? await res.json() : []
      app.innerHTML = \`
        <h1>Roster</h1>
        <button id="logout">Log out</button>
        <textarea id="numbers" rows="4" placeholder="One WhatsApp number per line"></textarea>
        <button id="add">Add numbers</button>
        <ul id="roster-list">
          \${roster.map((r) => \`<li>\${r.whatsapp_number}\${r.note ? ' — ' + r.note : ''} <button data-id="\${r.id}" class="remove">Remove</button></li>\`).join('')}
        </ul>
      \`
      document.getElementById('logout').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        boot()
      })
      document.getElementById('add').addEventListener('click', async () => {
        const numbers = document.getElementById('numbers').value.split('\\n').map((s) => s.trim()).filter(Boolean)
        await fetch('/api/admin/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers }),
        })
        renderRoster()
      })
      document.querySelectorAll('.remove').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await fetch('/api/admin/roster/' + btn.dataset.id, { method: 'DELETE' })
          renderRoster()
        })
      })
    }

    async function boot() {
      const user = await me()
      if (user && user.role === 'admin') return renderRoster()
      renderLogin()
    }

    boot()
  </script>
</body>
</html>`
}
```

- [ ] **Step 5: Wire static serving and `/admin` into `server/index.ts`**

Add these imports near the top of `server/index.ts`:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAdminPage } from './admin/page.ts'
```

Add this line right after the imports (computing the built frontend's directory):

```ts
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', 'dist')
```

After `app.use('/api/admin', adminRouter)`, add the `/admin` route and static serving, in this order (order matters — `/admin` must come before `express.static`, since both could theoretically resolve a request, and there is no `admin.html` in the static build to conflict with anyway, but explicit routes should always precede the static catch-all for clarity):

```ts
app.get('/admin', (_req, res) => {
  res.type('html').send(renderAdminPage())
})

app.use(express.static(distDir))
```

Do NOT add a wildcard `app.get('*', ...)` fallback — this is a multi-page site with 11 real HTML files, not a single-page app with client-side routing. `express.static` already serves each page (`/events.html`, `/shop.html`, etc.) directly since those files exist in `dist/`; anything not matched by an API route, `/admin`, or a static file should 404 normally, which is correct here (verified by this task's test).

- [ ] **Step 6: Add a Vite dev-server proxy so local `npm run dev` also reaches the API**

In `vite.config.ts`, inside the `server` object (which currently only has `fs: { allow: ['..'] }`), add a `proxy` entry:

```ts
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/server/staticAndAdmin.test.ts`
Expected: PASS — all 4 tests pass.

Run: `npm run test`
Expected: PASS — full suite, no regressions.

- [ ] **Step 8: Commit**

```bash
git add server/admin/page.ts server/index.ts vite.config.ts tests/server/staticAndAdmin.test.ts
git commit -m "Serve static frontend, admin page, and wire Vite dev proxy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 7: Member signup/login UI on the Account page

**Files:**
- Create: `src/accountAuth.ts`
- Modify: `src/pages/account.ts`
- Modify: `content/site.json` (account page `intro`)
- Test: `tests/accountAuth.test.ts`

**Interfaces:**
- Consumes: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` (Tasks 3-4, reached via the Vite dev proxy in dev, same-origin in production).
- Produces: `renderAuthSection(): string` and `mountAuthSection(): void`, exported from `src/accountAuth.ts` — `renderAuthSection` returns the HTML to inject, `mountAuthSection` wires up its event listeners after the HTML is in the DOM (same two-function split already used by `chrome.ts`'s `renderFooter`/`mountPlayer`).

- [ ] **Step 1: Update the Account page's intro copy**

In `content/site.json`, find `pages.account.intro` (currently `"There's no login here — membership works through the WhatsApp group."`) and change it to:

```json
      "intro": "Sign in below, or create an account if you're already in the WhatsApp group.",
```

- [ ] **Step 2: Write the failing test**

Create `tests/accountAuth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderAuthSection } from '../src/accountAuth'

describe('renderAuthSection', () => {
  it('renders a signup form with name, whatsapp, and password fields', () => {
    const html = renderAuthSection()
    expect(html).toContain('id="signup-form"')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="whatsappNumber"')
    expect(html).toContain('name="password"')
  })

  it('renders a login form with identifier and password fields', () => {
    const html = renderAuthSection()
    expect(html).toContain('id="login-form"')
    expect(html).toContain('name="identifier"')
  })

  it('renders a logged-in-state container for JS to fill in after checking /api/auth/me', () => {
    const html = renderAuthSection()
    expect(html).toContain('id="account-auth"')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/accountAuth.test.ts`
Expected: FAIL — `src/accountAuth.ts` doesn't exist yet, import error.

- [ ] **Step 4: Write `src/accountAuth.ts`**

```ts
export function renderAuthSection(): string {
  return `
    <section id="account-auth" class="mx-auto max-w-md px-6 py-10">
      <div id="account-auth-loading" class="text-sm text-[var(--color-muted)]">Checking your session…</div>
      <div id="account-auth-loggedin" class="hidden">
        <p class="mb-4">Logged in as <span id="account-auth-name" class="font-bold"></span>.</p>
        <button id="account-auth-logout" type="button" class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log out</button>
      </div>
      <div id="account-auth-forms" class="hidden space-y-8">
        <form id="signup-form" class="space-y-2">
          <h3 class="font-brand font-bold">Create an account</h3>
          <input name="name" type="text" placeholder="Name" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 px-3 py-2" />
          <input name="whatsappNumber" type="tel" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 px-3 py-2" />
          <input name="password" type="password" placeholder="Password" required minlength="8" class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 px-3 py-2" />
          <button type="submit" class="w-full rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">Sign up</button>
          <p id="signup-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
        <form id="login-form" class="space-y-2">
          <h3 class="font-brand font-bold">Log in</h3>
          <input name="identifier" type="text" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 px-3 py-2" />
          <input name="password" type="password" placeholder="Password" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 px-3 py-2" />
          <button type="submit" class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log in</button>
          <p id="login-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
    </section>
  `
}

export function mountAuthSection(): void {
  const loading = document.querySelector<HTMLDivElement>('#account-auth-loading')
  const loggedIn = document.querySelector<HTMLDivElement>('#account-auth-loggedin')
  const forms = document.querySelector<HTMLDivElement>('#account-auth-forms')
  const nameEl = document.querySelector<HTMLSpanElement>('#account-auth-name')
  const logoutBtn = document.querySelector<HTMLButtonElement>('#account-auth-logout')
  const signupForm = document.querySelector<HTMLFormElement>('#signup-form')
  const loginForm = document.querySelector<HTMLFormElement>('#login-form')
  const signupError = document.querySelector<HTMLParagraphElement>('#signup-error')
  const loginError = document.querySelector<HTMLParagraphElement>('#login-error')

  if (!loading || !loggedIn || !forms || !nameEl || !logoutBtn || !signupForm || !loginForm || !signupError || !loginError) {
    return
  }

  async function refresh() {
    const res = await fetch('/api/auth/me')
    loading!.classList.add('hidden')
    if (res.ok) {
      const user = await res.json()
      nameEl!.textContent = user.name
      loggedIn!.classList.remove('hidden')
      forms!.classList.add('hidden')
    } else {
      loggedIn!.classList.add('hidden')
      forms!.classList.remove('hidden')
    }
  }

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    refresh()
  })

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    signupError.textContent = ''
    const form = new FormData(signupForm)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        whatsappNumber: form.get('whatsappNumber'),
        password: form.get('password'),
      }),
    })
    if (res.ok) return refresh()
    const body = await res.json().catch(() => ({}))
    signupError.textContent = body.error ?? 'Signup failed.'
  })

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    loginError.textContent = ''
    const form = new FormData(loginForm)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }),
    })
    if (res.ok) return refresh()
    loginError.textContent = 'Login failed.'
  })

  refresh()
}
```

- [ ] **Step 5: Wire it into `src/pages/account.ts`**

Replace the full contents of `src/pages/account.ts`:

```ts
import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter, mountPlayer } from '../chrome'
import { renderPage } from '../renderPage'
import { renderAuthSection, mountAuthSection } from '../accountAuth'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'account')}
  <main class="relative isolate overflow-hidden">
    ${renderPage((site.pages as any).account)}
    ${renderAuthSection()}
  </main>
  ${renderFooter(site as any)}
`

mountPlayer(site as any)
mountAuthSection()
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/accountAuth.test.ts`
Expected: PASS — all 3 tests pass.

Run: `npm run test`
Expected: PASS — full suite, no regressions.

Run: `npm run build`
Expected: succeeds, no errors (confirms `account.ts`'s new import resolves cleanly through Vite).

- [ ] **Step 7: Commit**

```bash
git add src/accountAuth.ts src/pages/account.ts content/site.json tests/accountAuth.test.ts
git commit -m "Add member signup/login UI to the Account page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

---

## Task 8: Deploy to Render — staging, verify, then production

**Files:**
- Create: `render.yaml` (documentation of the deployed shape — the actual rollout below uses the CLI directly, not a Blueprint apply, specifically so staging can be verified before production exists; see note below)
- No other files modified.

**Interfaces:**
- Consumes: the fully wired `app` from Task 6, `server:migrate` and `server:seed-admin` npm scripts from Tasks 1 and 5.
- Produces: nothing further downstream — this is the last task.

**A note on Blueprint vs. CLI:** the design spec calls this a "render.yaml Blueprint" deploy. A committed `render.yaml` is still written in Step 1 below, as the durable record of the deployed shape. But Render Blueprints apply all defined resources together — there's no clean way to make a single `render.yaml apply` stop after staging for manual verification before creating production. So the actual rollout in Steps 2 onward uses the Render CLI directly (`render postgres create`, `render services create`) to create staging first, gate on verification, then create production — the same end shape `render.yaml` documents, just sequenced imperatively so the "verify staging before production" requirement is actually enforceable.

- [ ] **Step 1: Write `render.yaml`** (documentation of the deployed shape; not applied directly — see note above)

```yaml
services:
  - type: web
    name: community-hub-template
    runtime: node
    plan: starter
    region: oregon
    buildCommand: npm install && npm run build
    startCommand: npm run server:migrate && npm run server:seed-admin && npm run server
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: community-hub-template-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false

databases:
  - name: community-hub-template-db
    plan: basic_256mb
    region: oregon
```

Commit this file now (it doesn't get applied by the CLI steps below, but should exist from this point on):

```bash
git add render.yaml
git commit -m "Document deployed Render shape

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01C11gFArACuh9a1FQ6Uisrw"
```

- [ ] **Step 2: Confirm Render CLI login (human action required)**

Run: `D:/render-cli/render.exe whoami`

If this returns a Name/Email, continue to Step 3. **If it fails or is empty**, STOP — do not attempt to log in from this session. Ask the human to run `render login` themselves in a terminal they control (this is an interactive, browser-based login; a tool-run shell writes an empty token). Wait for confirmation before proceeding.

- [ ] **Step 3: Confirm the GitHub repo is connected to Render (human action may be required)**

Run: `D:/render-cli/render.exe services -o json`

If a service list returns without an auth/connection error, the account is usable. Creating a new service from this repo (Steps 4-5) additionally requires the GitHub repo to be linked in the Render account — if `render services create` in Step 5 fails with a repo-not-found/not-connected error, STOP and ask the human to connect the repo via the Render dashboard (Account Settings → GitHub) first, then retry.

- [ ] **Step 4: Create the staging Postgres instance**

```bash
D=$(D:/render-cli/render.exe postgres create --name community-hub-staging-db --plan basic_256mb --region oregon --confirm -o json)
echo "$D"
```

Note the returned `id` (looks like `dpg-...`) — call it `STAGING_DB_ID`.

Run: `D:/render-cli/render.exe postgres get $STAGING_DB_ID --include-sensitive-connection-info -o json`
Expected: JSON including `internalConnectionString` — save this value, it's needed in Step 5. Do not print or log this value anywhere outside this immediate step.

- [ ] **Step 5: Create the staging web service**

```bash
D:/render-cli/render.exe services create \
  --name community-hub-staging \
  --type web_service \
  --runtime node \
  --repo https://github.com/vtion001/community-hub-template.git \
  --branch feat/nav-multipage \
  --plan starter \
  --region oregon \
  --build-command "npm install && npm run build" \
  --start-command "npm run server:migrate && npm run server" \
  --health-check-path /api/health \
  --env-var NODE_ENV=production \
  --env-var DATABASE_URL="<the internalConnectionString from Step 4>" \
  --start-command "npm run server:migrate && npm run server:seed-admin && npm run server" \
  --confirm -o json
```

Note the returned service `id` — call it `STAGING_SRV_ID`. The start command runs both the (idempotent, `CREATE TABLE IF NOT EXISTS`) migration and the (idempotent, upsert-by-email) admin seed on every boot — no separate one-off seeding step is needed, and re-deploys stay safe to repeat.

- [ ] **Step 6: Set staging secrets (human action required)**

STOP — do not generate or type these values. Ask the human to set the following in the Render dashboard for the `community-hub-staging` service (Environment tab): `SESSION_SECRET` (any long random string), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Wait for confirmation these are set, then trigger a redeploy so the new env vars take effect (this deploy is also what actually seeds the admin account, via the start command from Step 5):

```bash
D:/render-cli/render.exe deploys create $STAGING_SRV_ID
```

- [ ] **Step 7: Verify staging**

```bash
BASE="https://community-hub-staging.onrender.com"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/health"
```
Expected: `200`.

Session persistence check:
```bash
curl -s -c /tmp/staging-cookies.txt -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"<the ADMIN_EMAIL set in Step 6>","password":"<the ADMIN_PASSWORD set in Step 6>"}'
curl -s -b /tmp/staging-cookies.txt "$BASE/api/auth/me"
```
Expected: the second call returns `{"id":"...","role":"admin","name":"Admin"}`, not a 401 — confirming the session cookie round-trips correctly against the staging Postgres session store.

Roster validation check:
```bash
curl -s -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
  -d '{"name":"Test","whatsappNumber":"09991234567","password":"testpass123"}'
```
Expected: `403` (that number isn't on the roster — this confirms the gate is actually enforced on staging, not silently open).

If either check fails, STOP — do not proceed to production. Debug staging first (check `D:/render-cli/render.exe logs --resources $STAGING_SRV_ID --tail`).

- [ ] **Step 8: Only after both staging checks in Step 7 pass — create production**

Repeat Steps 4-6 with `community-hub-prod-db` / `community-hub-prod` in place of the staging names, and `main` as the branch (confirm with the human which branch should back production before running this — `feat/nav-multipage` is a feature branch, production should likely track `main` once this work is merged there; do not assume, ask).

- [ ] **Step 9: Verify production**

Repeat Step 7's three checks against the production URL. Report the final production URL and both verification results to the human as the completion summary for this task.
