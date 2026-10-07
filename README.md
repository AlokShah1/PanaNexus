# PanaNexus — Integrated Digital Healthcare Ecosystem

A lightweight platform connecting patients, doctors, hospitals, health posts, blood/organ donors, and emergency services in one place. Sessions, verification, matching, and live trip tracking are handled server-side; the frontend is a thin, typed client.

## Stack

| App | Stack |
| --- | --- |
| `frontend/` | Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4 · socket.io-client |
| `backend/` | Node.js · Express 5 · Socket.IO · Prisma 8 (`@prisma/orm-postgres`) · zod · PostgreSQL |

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
frontend/src/tests/   unit tests (vitest)
backend/src/routes/   REST controllers grouped by resource
backend/src/lib/      auth, matching, blood logic, intelligence, analytics
backend/src/middleware/  auth/role/rate-limit middleware
backend/src/validations/ zod schemas
backend/prisma/       contract.prisma (Prisma 8), db.ts, emitted contract.json/d.ts
backend/scripts/      seed.ts (idempotent facility + demo seeding)
backend/src/routes/api.integration.test.ts  full HTTP integration suite
shared/               safe contracts (no Prisma/secrets)
render.yaml           Render Blueprint (API + Web)
docs/DEPLOY.md        Render + Neon runbook
docs/PROJECT_REPORT.md  architecture, security, QA results
```

## Development

Requirements: Node ≥ 22, local Docker Postgres (or Neon).

```bash
# 1. database (local dev)
docker run -d --name pn-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
docker exec -i pn-pg psql -U postgres -c 'create database pananexus'

# 2. backend
cd backend
cp .env.example .env            # fill DATABASE_URL/DIRECT_URL/AUTH_SECRET
npm install
npm run db:migrate              # apply committed Prisma migrations (creates schema on a fresh DB)
npm run seed                    # idempotent: facilities
npm run seed -- --demo          # + demo accounts, ambulance, blood stock
npm run dev                     # http://localhost:4000 (health: /health)

# 3. frontend
cd frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                     # http://localhost:3000
```

Admin auto-bootstraps on first boot from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Demo accounts (`TestPass!123`): `operator@pananexus.local`, `dr.khan@pananexus.local`.

## Checks

```bash
cd backend && npm run typecheck && npm test && npm run build
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Current: backend **100 tests / 16 files**, frontend **36 tests / 5 files** — all green, plus the live browser QA harness (60 route×viewport loads, full emergency E2E incl. live socket verification; see `docs/PROJECT_REPORT.md` §4).

## Security

- HttpOnly signed session cookies (`hc_session`); scrypt password hashing; per-role route middleware.
- Doctor licenses and password hashes never serialised; unverified professionals excluded from the public directory.
- Global + per-route rate limiting; zod validation at every boundary.
- Sensitive production info lives only in server env vars (see `.env.example` files).

## Deployment

See `render.yaml` and `docs/DEPLOY.md`. The API's `preDeployCommand` applies the committed
Prisma migrations to Neon's `DIRECT_URL` before the app starts, so first boot never hits an
uninitialized schema (`npm run db:migrate` locally; `npm run start:prod` runs migrate + start).
Production cookies are `SameSite=None; Secure` — both apps must be served over HTTPS
(Render does this automatically).