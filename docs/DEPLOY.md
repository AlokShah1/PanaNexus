# Deploying PanaNexus (Render + Neon)

PanaNexus is two independently deployable apps:

- **API** (`backend/`) — Express + Socket.IO, Prisma 8 ORM over PostgreSQL
- **Web** (`frontend/`) — Next.js (App Router) server + client

The blueprint in `render.yaml` boots both. It is a sample you can deploy as-is on Render's Free/Starter plans.

## 1. Database (Neon)

1. Create a Neon project → new database `pananexus`.
2. Copy two connection strings:
   - **Pooled** (`.neon.tech/…-pooler…`, same host as the app for pooled HTTP) → `DATABASE_URL`
   - **Direct** (unpooled) → `DIRECT_URL`
3. If the schema is empty (new Neon branch/database), it is created automatically by the
   API's start-time migration step (below). Point `DATABASE_URL`/`DIRECT_URL` at the
   intended production database — **do not** point them at a dev branch.

## 2. Backend service (Render, type: web, env: node)

Build: `cd backend && npm ci && npm run build`
Start: `cd backend && npm start`
Health: `GET /health`

Required env vars: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=https://<web-host>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

- **The schema is applied at start time, before the server listens.** `npm start` runs
  npm's `prestart` hook first: `prisma db migrate` (replay-only; "nothing to run" when up
  to date) and then `prisma db verify` (aborts if the database marker or live schema does
  not match the contract). Only after both succeed does Express boot. On a blank Neon
  database the committed baseline migration creates all 20 tables, indexes, unique
  constraints and foreign keys. This ordering is guaranteed because the start command runs
  after the build has installed `node_modules` — Render's `preDeployCommand` is **not**
  used, since it executes before the build installs the Prisma CLI.
- **The server refuses to start against an uninitialized schema**: the boot-time probe of
  the `User` table fails fast with an actionable message (instead of surfacing
  `relation "public.User" does not exist`) if the migration step was skipped.
- The **admin account** is created automatically on first boot (bootstrap is idempotent).
  Set a strong `ADMIN_PASSWORD` — it is **required** in production and the server fails fast
  at boot if it is unset (never a silently unusable admin).
- `AUTH_SECRET` signs HttpOnly session cookies. Generate once and never rotate casually — sessions are stateless (scrypt + HMAC signed) and invalidating means logging everyone out.
- Production cookies use `SameSite=None; Secure` (cross-site Vercel/Render → API). Render serves HTTPS automatically.
- `FRONTEND_URL` is the CORS origin and is also **required** in production (fail-fast at
  boot rather than defaulting to `http://localhost:3000`). The backend reflects requests
  only from this origin with `Access-Control-Allow-Credentials: true` (origin matching
  ignores a trailing `/`). Auth endpoints apply their own stricter rate limit.

## 3. Frontend service (Render, type: web, env: node)

Build: `cd frontend && npm run build`
Start: `npm run start`

Required env vars: `NEXT_PUBLIC_API_URL=https://<api-host>` (the **public** API origin; baked into the bundle).

## 4. Seed

From any machine with raster access to the Neon `DATABASE_URL` (set it in `backend/.env` first):

```bash
cd backend
npx prisma contract emit   # not required for runtime; emitted files are committed
npm run seed               # idempotent: creates 8 Bhopal healthcare facilities
npm run seed -- --demo     # + demo operator/ambulance, demo doctor, blood stock
```

Demo credentials (dev/demo only, from `SEED_PASSWORD` or default `TestPass!123`):

| Role | Email |
| --- | --- |
| Admin | `ADMIN_EMAIL` value (e.g. pananexusadmin@gmail.com) |
| Ambulance operator | `operator@pananexus.local` |
| Doctor | `dr.khan@pananexus.local` |

## 5. Verification workflow

- Professionals (doctor, facility staff, ambulance operator) register → `PENDING`.
- Admin approves via the Admin console (`/admin`) or `POST /admin/verifications/:id/approve`.
- On approve, the system syncs specialised rows (Doctor license, HealthcareFacility for staff) and, for doctors, scans for license duplicates (409 `LICENSE_TAKEN`).
- Ambulance operators are automatically VERIFIED once their driver name + phone are provided at registration (simplification: dispatch needs them online, audits still log every event).

## 6. Requests / limits

- Global API rate limit defaults to 900 req / 15 min (`RATE_LIMIT`). Raise for load testing, lower for tight production control.
- Auth routes are limited by `AUTH_RATE_LIMIT` (default 30 / 15 min). Keep this tighter than the global limit in production.

## 7. Migrations

Prisma 8 (`@prisma/orm-postgres`) uses **declarative schema migrations**: the schema is
authored in `backend/prisma/contract.prisma`, emitted to `contract.json`/`contract.d.ts`,
and the files under `backend/migrations/app/` are replayed against PostgreSQL with the
Prisma CLI. Migrations are **committed to git** and form the single source of truth for
what the production schema should look like.

Workflow:

1. Change `backend/prisma/contract.prisma`, then emit artefacts:

   ```bash
   cd backend && npx prisma contract emit   # updates contract.json / contract.d.ts
   ```

2. Author a migration for the change (offline planner, never touches the DB):

   ```bash
   npx prisma migration plan --name <slug> --confirm <id>
   ```

3. Inspect the generated `backend/migrations/app/<timestamp>_<slug>/`, then commit.

4. Apply against a specific database (replay-only; safe to re-run):

   ```bash
   npm run db:migrate        # uses prisma.config.ts (DIRECT_URL ?? DATABASE_URL)
   npm run db:migrate:prod   # explicit: prisma db migrate --db "${DIRECT_URL:-$DATABASE_URL}"
   ```

5. Verify the database matches the contract (exit 0, else abort):

   ```bash
   npm run db:verify
   ```

6. Check status (no pending migrations → ready):

   ```bash
   npm run db:status
   ```

Production start runs migration + verification automatically: `npm start` executes npm's
`prestart` hook (`npm run db:migrate && npm run db:verify`) before `node dist/src/server.js`.
Render's startCommand is `cd backend && npm start`, so every boot is: build → migrate →
verify → admin bootstrap → listen. This is not `prisma db push` — `db migrate` is a
plan-based, replay-only, idempotent apply; `db verify` never mutates the database.

Rules:

- Never run `prisma migrate dev` or `prisma migrate reset` against production.
- Migrations run **before** boot via the start command (`npm start` → `prestart`), never as a blind
  `db push` on startup, and never in Render's `preDeployCommand` (it runs before the build
  installs the Prisma CLI). Startups against an uninitialized schema fail fast.
- Migrations connect with the **unpooled** `DIRECT_URL` (DDL over Neon's pooled
  `DATABASE_URL` is unsupported). The runtime app itself uses pooled `DATABASE_URL`.