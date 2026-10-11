# PanaNexus — Integrated Digital Healthcare Ecosystem

A lightweight platform connecting patients, doctors, hospitals, health posts, blood/organ donors, and emergency services in one place. Sessions, verification, matching, and live trip tracking are handled server-side; the frontend is a thin, typed client.

**Storage**: Structured data (PostgreSQL on Neon) + private medical PDFs (S3-compatible object storage — AWS S3 or Filebase free tier).

## Timezone and language policy

- **Interface language: English only.** No translations or language selector are offered.
- **Timezone: Asia/Kathmandu (NPT, UTC+5:45), fixed — no daylight saving.** Facility
  hours and appointment slots are authored and displayed in NPT, independent of the
  server's clock (Render runs in UTC). Instants are stored as ISO-8601 UTC and
  converted for display. See `backend/README.md` → “Timezone handling”.

## Stack

| App | Stack |
| --- | --- |
| `frontend/` | Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4 · socket.io-client |
| `backend/` | Node.js · Express 4 · Socket.IO · Prisma 8 (`@prisma/orm-postgres`) · zod · PostgreSQL |

## Roles

- **Patient** — emergency requests with live tracking, appointment booking, notifications, blood search, medical records, feedback
- **Doctor** — verification onboarding, profile + availability, appointment schedule, records
- **Facility staff** — facility profile, blood stock + requests
- **Ambulance operator** — fleet board, accept/status/location, realtime broadcast
- **Admin** — verification approvals, user suspension, audit log, feedback, analytics, settings

## Directory

```
frontend/src/app/     pages + layouts (client components call the API via rewrites)
frontend/src/lib/     API client, session helpers, realtime socket, formatting
frontend/src/**/*.test.ts  unit tests (vitest, colocated with source)
backend/src/routes/   REST controllers grouped by resource
backend/src/lib/      auth, matching, blood logic, intelligence, analytics
backend/src/middleware/  auth/role/rate-limit middleware
backend/src/validations/ zod schemas
backend/prisma/       contract.prisma (Prisma 8), db.ts, emitted contract.json/d.ts
backend/scripts/      seed.ts + reset-demo.ts + bootstrap-admin.ts
backend/src/routes/api.integration.test.ts  full HTTP integration suite
frontend/src/components/dashboard/ui.tsx  shared dashboard shell primitives
.github/workflows/ci.yml  CI: migrate → seed → typecheck → test → build (backend + frontend)
shared/               safe contracts (no Prisma/secrets)
render.yaml           Render Blueprint (API + Web)
docs/design-system.md  tokens + reusable UI primitives
docs/DEPLOY.md        Render + Neon runbook
docs/PROJECT_REPORT.md  architecture, security, QA results
```

## Development

Requirements: Node ≥ 22, local Docker Postgres (or Neon), `mkcert` for local HTTPS (recommended).

```bash
# 1. database (local dev)
docker run -d --name pn-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
docker exec -i pn-pg psql -U postgres -c 'create database pananexus'

# 2. backend (requires HTTPS for cookies — see backend/README.md for mkcert setup)
cd backend
cp .env.example .env            # fill DATABASE_URL/DIRECT_URL/AUTH_SECRET
npm install
npm run db:migrate              # apply committed Prisma migrations (creates schema on a fresh DB)
npm run seed                    # idempotent: facilities
DEMO_MODE=true npm run seed -- --demo   # + synthetic demo accounts (dev/demo only)

# Option A: HTTPS with lvh.me (recommended)
# mkcert lvh.me "*.lvh.me" localhost 127.0.0.1 ::1
# export HTTPS=true SSL_CERT_FILE=./lvh.me+3.pem SSL_KEY_FILE=./lvh.me+3-key.pem
# npm run dev    # runs on https://lvh.me:4000

# Option B: HTTP with browser flag (quick test)
# chrome --unsafely-treat-insecure-origin-as-secure=http://localhost:3000,http://localhost:4000
npm run dev                     # http://localhost:4000 (health: /health)

# 3. frontend
cd frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=https://lvh.me:4000 (or http://localhost:4000 with browser flag)
npm install
npm run dev                     # https://lvh.me:3000 (or http://localhost:3000 with browser flag)
```

**Important:** Session cookies use `SameSite=None; Secure` in all environments. Local development requires HTTPS — use `mkcert` with `lvh.me` (resolves to 127.0.0.1) or a browser flag to allow insecure SameSite=None. See `backend/README.md` for detailed setup.

**Filebase (S3-compatible object storage for medical PDFs)** — Free tier available:
```bash
# .env (backend)
STORAGE_DRIVER=s3
S3_REGION=us-east-1
S3_BUCKET=pananexus-medical-reports
S3_ENDPOINT=https://s3.filebase.com
S3_ACCESS_KEY_ID=<your-filebase-access-key>
S3_SECRET_ACCESS_KEY=<your-filebase-secret-key>
# Filebase free tier: 5 GB storage, 1 GB/month egress, 100K requests/month.
# Bucket must remain private; never enable public access.
```

Admin auto-bootstraps on first boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Demo data is dev/demo-only: it requires `DEMO_MODE=true` (rejected in production) and uses the reserved `@pananexus.local` domain. The seed prints one-time demo credentials; set `DEMO_PASSWORD` to choose the password.

In production the backend requires `FRONTEND_URL` (CORS origin) and `ADMIN_PASSWORD`,
and fails fast at boot if either is missing. The frontend's `NEXT_PUBLIC_API_URL` must
point at the deployed API origin — a single API client (`frontend/src/lib/api.ts`)
serves every page, and auth screens surface domain-specific messages (login vs.
registration) with no facility requests.

## Checks

```bash
cd backend && npm run typecheck && npm test && npm run build
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Current (local run, seeded DB): backend **163 passed (163) across 19 files**, frontend **44 passed across 6 files**. Running the full backend suite requires the database migrated, the synthetic demo dataset seeded, and the admin bootstrapped (the integration suites gate on a live admin session — see `backend/README.md`). CI (`.github/workflows/ci.yml`) runs exactly this against a fresh Postgres: migrate → seed → bootstrap → typecheck → test → build for the backend, and lint → typecheck → build for the frontend.

> Note: earlier docs referenced an automated browser QA harness (`check.js`, route×viewport sweeps). That script is **not present in this repository**, so the claim is removed — treat browser/viewport behaviour as manually verified, not automated.

## Security

- HttpOnly signed session cookies (`hc_session`); scrypt password hashing; per-role route middleware.
- **Session cookies use `SameSite=None; Secure` in all environments** (including development) for cross-origin cookie support; local development requires HTTPS (use `lvh.me` with `mkcert` or browser flag — see `backend/README.md`).
- Doctor licenses and password hashes never serialised; unverified professionals excluded from the public directory.
- Global + per-route rate limiting; zod validation at every boundary.
- Sensitive production info lives only in server env vars (see `.env.example` files).

## Deployment

See `render.yaml` and `docs/DEPLOY.md`. The API boots via `npm start`, whose npm `prestart`
hook runs `prisma db migrate` (idempotent replay of committed migrations) then `prisma db
verify` (aborts unless the database matches the contract) before `node dist/src/server.js`.
Render's startCommand is `cd backend && npm start`, so every deploy is:
install → build → migrate → verify → admin bootstrap → listen. Migrations are **not** run
in Render's `preDeployCommand` (it executes before the build installs the Prisma CLI).
Production cookies are `SameSite=None; Secure` — both apps must be served over HTTPS
(Render does this automatically).