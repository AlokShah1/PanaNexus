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
3. If the Render-generated UUIDs don't match, apply the schema by pointing the backend at the new DB and running the seed; the ORM auto-syncs the schema on first query (`@prisma/orm-postgres`).

## 2. Backend service (Render, type: web, env: node)

Build: `cd backend && npm run build`
Start: `node dist/src/server.js`
Health: `GET /health`

Required env vars: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=https://<web-host>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

- The **admin account** is created automatically on first boot (bootstrap is idempotent). Set a strong `ADMIN_PASSWORD`.
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

Prisma 8 (`@prisma/orm-postgres`) runs a **contract + schema-sync** workflow instead of classic SQL migrations: the schema is declared in `backend/prisma/contract.prisma` (emitted to `contract.json`/`contract.d.ts` and re-applied on startup). On Neon this is fully automatic. For a scratch environment you can also run:

```bash
cd backend && npx prisma contract emit
```