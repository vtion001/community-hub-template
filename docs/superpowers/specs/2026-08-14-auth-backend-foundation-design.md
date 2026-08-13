# Auth + backend + hosting foundation — design

**Date:** 2026-08-14
**Project:** community-hub-template (Sig & Espresso)

## Problem

This project is currently a 100% static site (Vite build, no server, no database, no auth) — content lives entirely in `content/site.json`, hand-edited and committed to git. The site owner wants to (a) eventually manage page content through a login-gated admin panel, and (b) let community members create accounts, gated to actual WhatsApp group members. Neither is buildable on the current architecture, which has no backend of any kind.

This was originally raised as part of "show our own Luma events, prioritized above other Manila dev-community events." Luma was investigated and dropped — a paid Luma Plus subscription plus a secret API key with no discovery endpoint for events outside calendars you own made it a poor fit; the plan pivoted to "build our own events system," which surfaced the login/admin ambition. That request bundles three independent subsystems: auth, a general admin/CMS, and events specifically. Per project convention (page-by-page review, one spec per subsystem), this spec covers **only the foundation**: hosting, auth, and role model. A general content-editing CMS and the Events feature itself are explicitly out of scope here and become their own future specs, built on top of what this spec establishes.

## Approach

Add a minimal Express API alongside the existing static Vite frontend, deployed as a single Render web service (serves both the built static site and `/api/*` routes — no CORS, no second deploy target), backed by a Render-managed Postgres instance.

Rejected alternatives:
- **Rewrite the frontend on Next.js/Vercel with NextAuth** — gets batteries-included auth, but means discarding the `renderPage.ts` block system, `chrome.ts`, and the tests built for all 11 pages this same week, for no functional gain this project needs.
- **Two separately deployed services** (static frontend + standalone API) — same backend tech as the chosen approach, but adds CORS handling and a second deploy target for no benefit at this scale.

## Roles

Two roles in one `users` table, distinguished by a `role` column (`admin` | `member`) — not two parallel systems.

- **Admin**: exactly one account. Seeded once at deploy time from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (set in Render's dashboard, never committed to git) — not created through public signup.
- **Member**: community signup, gated by WhatsApp-roster match (see below).

## Data model (Postgres)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  name TEXT NOT NULL,
  email TEXT UNIQUE,              -- admin only
  whatsapp_number TEXT UNIQUE,    -- member only, normalized (see below)
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number TEXT UNIQUE NOT NULL,  -- normalized, same scheme as users.whatsapp_number
  note TEXT,                              -- optional, admin's own reference (e.g. a name)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
```

`sessions` follows the shape expected by `connect-pg-simple` (the Postgres session store for `express-session`) — no separate Redis instance, one less moving part for a project this size.

## Phone number normalization

Philippine numbers appear in the wild as `+639171234567`, `09171234567`, and `9171234567` — all the same number. Every write and every comparison (signup input, roster entries) goes through one normalization function: strip all non-digit characters, then if the result starts with `0` and is 11 digits, replace the leading `0` with `63`; if it's 10 digits (no leading 0 or 63), prepend `63`; store the final form as `+63XXXXXXXXXX`. This function is the single source of truth — `roster.whatsapp_number` and `users.whatsapp_number` are both stored in this normalized form, so lookups are a plain equality check, not a fuzzy match.

## API surface

- `POST /api/auth/signup` — body: `{ name, whatsappNumber, password }`. Normalizes `whatsappNumber`, checks it against `roster`. If no match: `403` with a clear message ("not on our member list yet — ping an admin"). If match: creates a `member` user (password hashed with bcrypt), starts a session, `201`.
- `POST /api/auth/login` — body: `{ identifier, password }` where `identifier` is an email (admin) or WhatsApp number (member, normalized before lookup). The two are distinguished by shape, not a separate field: if `identifier` contains `@`, look up by `users.email`; otherwise normalize it as a phone number and look up by `users.whatsapp_number`. Verifies against `users`, starts a session on success, `401` on failure (generic message — do not reveal whether the identifier exists).
- `POST /api/auth/logout` — destroys the session.
- `GET /api/auth/me` — returns the current session's user (or `401` if not logged in) — used by the frontend to know if someone's logged in.
- `GET /api/admin/roster` — admin-only (session role check). Lists roster entries.
- `POST /api/admin/roster` — admin-only. Body: `{ numbers: string[] }` — a pasted list, one number per line on the frontend, normalized and inserted (duplicates ignored, not errored).
- `DELETE /api/admin/roster/:id` — admin-only. Removes one roster entry.

No public signup for admin, no password reset flow, no rate limiting on these routes in this spec — all explicitly deferred (see Out of scope).

**Security defaults** (not left to implementation-time judgment): bcrypt cost factor 12. Session cookies: `httpOnly`, `secure` (Render terminates TLS, so this is safe in both staging and production), `sameSite: 'lax'`. Session TTL 30 days, sliding (refreshed on activity). These are the floor, not a ceiling — the implementation plan should not go below them.

## Frontend touch points

Minimal, additive changes only:
- `account.html` (already exists in nav as a placeholder) becomes the member login/signup entry point — a plain HTML form posting to `/api/auth/signup` or `/api/auth/login` via `fetch`, no new client-side framework.
- A new `/admin` route, server-rendered by Express directly (plain HTML, not part of the Vite build) — not linked from the public nav. Handles admin login and the roster paste/list/delete UI.
- No changes to any of the other 10 static pages, `chrome.ts`, `renderPage.ts`, or their tests.

## Deployment

`render.yaml` Blueprint defines:
- One Node web service: build command `npm install && npm run build`, start command runs the Express server (which serves `dist/` for static routes and handles `/api/*` + `/admin`).
- One Render-managed Postgres instance, `DATABASE_URL` auto-wired to the web service.
- Env vars: `DATABASE_URL` (auto), `SESSION_SECRET` (generated), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (set manually in Render's dashboard, never committed).

**Staging before production**, per this session's explicit instruction: deploy first to a staging Render service (separate service + separate Postgres instance from the same Blueprint pattern, distinct env/dashboard entry), verify there — specifically:
1. Session persistence: log in, reload, confirm the session survives (cookie + `sessions` table row present, `GET /api/auth/me` still returns the user).
2. Roster validation: attempt signup with a number not on the roster (expect `403`), add that number to the roster via the admin UI, retry signup (expect `201`).

Only after both checks pass on staging does the same Blueprint get applied to a production service. Production Postgres starts empty except for the seeded admin account — no member or roster data is pre-populated (that data doesn't exist yet; the roster is loaded later, by the admin, through the UI this spec builds).

## Testing

Vitest + `supertest` for the new `/api/*` routes, run against a real ephemeral test Postgres (not mocked) — matches this project's existing testing philosophy (`tests/renderPage.test.ts` asserts against real rendered output, not mocks). Coverage:
- Phone normalization function: all three input formats (`+63...`, `0...`, bare 10-digit) produce the same normalized value; malformed input is rejected.
- Signup: roster match succeeds, roster miss returns `403`, duplicate WhatsApp number is rejected.
- Login: correct credentials succeed for both roles, incorrect credentials return `401` (generic message), admin `identifier` is email-shaped, member `identifier` is a WhatsApp number.
- Roster CRUD: only accessible with an admin session (member session gets `403`, no session gets `401`); add/list/delete round-trip.

No changes needed to the existing Vitest suite (`tests/*.test.ts`, `node` environment, no DOM) — the new backend tests live alongside it as a separate concern (e.g. `server/tests/`), same `vitest` runner.

## Out of scope

- The Events feature itself (data model, display, priority ordering) — a future spec, built on this foundation.
- A general content-editing CMS for the other 10 pages — a future spec, if/when needed.
- OAuth / social login.
- Password reset / forgot-password flow.
- Rate limiting on auth endpoints — should exist before a real public launch, not blocking this foundation.
- Admin roster bulk-import from a file (CSV, etc.) — paste-a-list-of-numbers via the admin UI is sufficient for now.
- Any real roster or member data — the admin provides the real roster after this ships; nothing is fabricated here.
