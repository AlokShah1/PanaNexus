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
   API's pre-deploy migration step (below). Point `DATABASE_URL`/`DIRECT_URL` at the
   intended production database — **do not** point them at a dev branch.

## 2. Backend service (Render, type: web, env: node)

Build: `cd backend && npm run build`
Pre-deploy: `cd backend && npx prisma db migrate --db "$DIRECT_URL"` (from `render.yaml`)
Start: `node dist/src/server.js`
Health: `GET /health`

Required env vars: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=https://<web-host>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

- **The schema is created by the pre-deploy migration**, not at app startup. On a blank
  Neon database the committed baseline migration creates all 20 tables, indexes, unique
  constraints and foreign keys. The migration is idempotent — `db migrate` replays only
  migrations that haven't been applied ("nothing to run" when up to date).
- **The server refuses to start against an uninitialized schema**: before booting it
  probes the `User` table and fails with an actionable message (run the migration) instead
  of surfacing `relation "public.User" does not exist`.
- The **admin account** is created automatically on first boot (bootstrap is idempotent).
  Set a strong `ADMIN_PASSWORD`.
- `AUTH_SECRET` signs HttpOnly session cookies. Generate once and never rotate casually — sessions are stateless (scrypt + HMAC signed) and invalidating means logging everyone out.
- Production cookies use `SameSite=None; Secure` (cross-site Vercel/Render → API). Render serves HTTPS automatically.

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
   npm run db:migrate                      # uses prisma.config.ts (DIRECT_URL ?? DATABASE_URL)
   npm run db:migrate:prod                 # explicit: prisma db migrate --db "$DIRECT_URL"
   npx prisma db migrate --db "$DIRECT_URL"   # the exact command render.yaml preDeploys
   ```

5. Check status (no pending migrations → ready):

   ```bash
   npm run db:status
   ```

Rules:

- Never run `prisma migrate dev` or `prisma migrate reset` against production.
- Migrations run **before** boot (Render `preDeployCommand`), never as a blind
  `db push` on startup. Startups that hit an uninitialized schema fail fast.
- Migrations connect with the **unpooled** `DIRECT_URL` (DDL over Neon's pooled
  `DATABASE_URL` is unsupported). The runtime app itself uses pooled `DATABASE_URL`.