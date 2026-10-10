# PanaNexus Backend

Express 5 + Socket.IO + Prisma 8 (`@prisma/orm-postgres`) over PostgreSQL. All routes use zod validation; middleware enforces auth/role/verification; rate limits apply globally and on auth routes.

## Setup

```bash
cp .env.example .env
# Set DATABASE_URL (pooled, runtime), DIRECT_URL (unpooled, migrations/verify), AUTH_SECRET (min 16 chars for HMAC), FRONTEND_URL (CORS origin), ADMIN_EMAIL, ADMIN_PASSWORD (min 8, required in production).
npm install
npm run db:migrate     # replay committed migrations
npm run seed           # idempotent facilities
npm run dev            # localhost:4000; health endpoint: GET /health; readiness: GET /ready
```

## Development HTTPS Setup

Session cookies use `SameSite=None; Secure` in **all environments** (including development) to support cross-origin requests between the frontend and backend. This requires HTTPS even in local development.

**Option 1: `lvh.me` with `mkcert` (recommended)**
```bash
# Install mkcert
brew install mkcert nss  # macOS
# or: sudo apt install libnss3-tools && mkcert -install  # Linux

# Generate cert for lvh.me (resolves to 127.0.0.1)
mkcert lvh.me "*.lvh.me" localhost 127.0.0.1 ::1

# Run backend with HTTPS
export NODE_ENV=development
export HTTPS=true
export SSL_CERT_FILE=./lvh.me+3.pem
export SSL_KEY_FILE=./lvh.me+3-key.pem
npm run dev
```

**Option 2: Browser flag for insecure SameSite=None (quick test)**
```bash
# Chrome/Edge
chrome.exe --user-data-dir=/tmp/chrome-dev --unsafely-treat-insecure-origin-as-secure=http://localhost:3000,http://localhost:4000

# Firefox: about:config -> network.cookie.sameSite.noneRequiresSecure = false
```

**Frontend configuration:**
- Set `NEXT_PUBLIC_API_URL=https://lvh.me:4000` (or `http://localhost:4000` with browser flag)
- Frontend runs on `https://lvh.me:3000` (or `http://localhost:3000` with browser flag)

**Important:** The frontend and backend must both use HTTPS (or both use the browser flag) for cookies to work with `SameSite=None; Secure`.

## Important dependencies

- `express`, `express-rate-limit`: routing and rate limiting.
- `cors`, `helmet`: CORS and security headers.
- `cookie-parser`, `express` cookie support: session cookies (`hc_session`).
- `zod`: validation schemas (`validations/`).
- `prisma` (contract-based, `@prisma/orm-postgres`): `prisma/contract.prisma`, emitted `contract.json`/`contract.d.ts`. Migration workflow: `contract:emit` → `migration plan` → `db:migrate` → `db:verify`.
- `node:http`, `socket.io`: realtime events (`realtime.ts`).
- `crypto` (built-in): `hashPassword` (scrypt), HMAC session tokens, download token signatures (`storage.ts`).

## Architecture

- `routes/index.ts` groups controllers by resource (`auth`, `facilities`, `appointments`, `ambulances`, `emergency`, `admissions`, etc.).
- `middleware/auth.ts`: session management (`readSessionToken`, `touchSession`, cookie `SameSite=None; Secure` in all environments); `requireAuth`, `requireVerified`, `requireRole`.
- `middleware/origin.ts`: CSRF protection (`originGuard`) — allows `GET`/`HEAD`/`OPTIONS` unconditionally; for mutating requests, requires `Origin` header to match `FRONTEND_URL` (production only allows production origin; dev also allows localhost).
- `middleware/auth-core.ts`: `hashPassword` (scrypt), `verifyPassword`, session token reading.
- `lib/storage.ts`: `StorageAdapter` interface; `local` driver (`localReportsDir`, signed download tokens with HMAC); `s3` adapter (AES256 server-side encryption, `S3Client` with optional explicit credentials, `PutObjectCommand`/`DeleteObjectCommand`/`HeadObjectCommand`/`GetObjectCommand` via `@aws-sdk/s3-request-presigner`). Production requires `STORAGE_DRIVER=s3` with `AWS_REGION`, `AWS_S3_BUCKET`, and `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` paired; missing vars cause safe startup failure (`env.ts`).
- `lib/auth.ts`: cookie options (`httpOnly: true`, `path: '/'`); **all environments use `sameSite: 'none'`, `secure: true`** (requires HTTPS; for local development use `lvh.me` with a self-signed cert via `mkcert`, or configure browser to allow insecure SameSite=None).
- `routes/reports.ts`: private file uploads (reports) with audit logs; downloads served via signed URLs; authorization enforced by doctor/patient relationship checks.
- `routes/medicalRecords.ts`: doctor uploads for related patients; `requireVerified` + relationship checks.

## Database and Prisma workflow

Schema authored in `prisma/contract.prisma`. Emitted to `contract.json`/`contract.d.ts`. Migration files committed in `migrations/app/`. Workflow:

1. Edit `contract.prisma`.
2. `npm run contract:emit` (updates emitted files).
3. `npx prisma migration plan --name <slug>` (offline planner, never touches DB).
4. Inspect `migrations/app/<timestamp>_<slug>/`.
5. `npm run db:migrate` (replay against `DATABASE_URL`; uses unpooled `DIRECT_URL` via `prisma.config.ts`).
6. `npx prisma migration ref set db <hash>` (advance ref manually when `advancedRef` is null).
7. `npm run db:verify` (exit 0 only when DB matches contract).
8. `npm run db:status` (confirm no pending migrations).

Migration applied: `add_admission_model` (`hash 928229...`); partial unique indexes: `admission_active_ward`, `appt_active_slot`, `trip_active_ambulance`.

## Security and authorization

- `requireRole('ADMIN', 'DOCTOR', ...)` checks `user.role`.
- `requireVerified` checks `user.verificationStatus` (VERIFIED required for protected routes; `PENDING` doctors cannot access protected routes; `SUSPENDED` accounts blocked with session revocation).
- `requireAuth` reads session cookie from `Cookie` header and validates against `db.orm.public.Session`.
- Rate limits: global (`RATE_LIMIT`, default 900/15min) and auth (`AUTH_RATE_LIMIT`, default 30/15min); disabled in `NODE_ENV=test`.
- CORS production: `FRONTEND_URL` only (`https://pananexus-web.onrender.com`); dev allows localhost (`3000`/`3300`); credentials enabled (`credentials: true`).
- **Session cookies use `SameSite=None; Secure` in all environments**; local development requires HTTPS (use `lvh.me` with `mkcert` or browser flag for insecure SameSite=None).
- `originGuard` rejects mutating requests from unlisted origins with 403 `CSRF_ORIGIN_REJECTED`; allows safe methods unconditionally; server-to-server requests (no `Origin` header) untouched.
- Audit logs (`AuditLog`) created for mutations (`ACTION_ENTITY`), tracking `entity`, `entityId`, `actorId`, `metadata`. Failures caught (`.catch(() => undefined)`) so audit creation never crashes the main operation.
- Sensitive production info never exposed: `productionStorageError` names missing variables (e.g., `AWS_REGION`, `AWS_S3_BUCKET`) without values; cookie settings never expose `AUTH_SECRET`.

## Health and readiness

- `GET /health` returns `{ status: 'ok' }` (always).
- `GET /ready` queries `public.User` via DB; returns `{ status: 'ready' }` (200) or `{ status: 'not ready', reason: 'database' }` (503) on DB failure.
- Startup sequence (`npm start`): `prestart` (`db:migrate` + `db:verify`) then `node dist/src/server.js`. If DB is unready, server fails fast with an actionable message.

## Tests

- Integration (`api.integration.test.ts`): full HTTP test suite covering auth, verification, emergency lifecycle, patient resources, private medical reports, facility bed capacity, appointment availability/booking integrity, ambulance dispatch integrity, admission integrity (skipped due to admin-approval dependency in test env but route implemented with transaction + capacity checks), session revocation, messaging, analytics.
- Unit (`lib/*.test.ts`): `auth`, `demoData`, `hours`, `appointments`, `dispatch`, `maps`, `geo`, `blood`, `matching`, `notification`, etc.
- Focused regression tests performed: `auth.test.ts` (cookie lifetime), `hours.test.ts` (timezone mapping), `dispatch.test.ts` (escalation/state), `demoData.test.ts` (defensive cleanup filter), `api.integration.test.ts` (appointment availability/book integrity, ambulance dispatch, admission integrity — admission skipped in this env due to admin dependency but verified separately with reproduction).

## Environment variables

See `.env.example`. Key variables explained:
- `DATABASE_URL` (required, pooled, runtime) and `DIRECT_URL` (optional, unpooled, migrations/verify).
- `AUTH_SECRET` (required, min 16 chars, signs session cookies).
- `FRONTEND_URL` (required in production; CORS origin; fail-fast if missing).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (admin auto-bootstraps; `ADMIN_PASSWORD` required and min 8 chars in production; missing = startup failure).
- `DEMO_MODE` (default `false`; `true` enables destructive demo seeding/reset; production rejects if `true`).
- `NODE_ENV`: `development` (cookies `SameSite=None; Secure` — requires HTTPS via `lvh.me`/`mkcert`), `test` (rate limits disabled), `production` (`SameSite=None`/secure cookies; requires S3; rejects `DEMO_MODE=true`).
- `STORAGE_DRIVER`: `local` (dev/default) or `s3` (production; requires `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; production fails safe without them).
- `TZ`: `Asia/Kolkata` (fixed IST offset; no DST).
- `PORT`, `RATE_LIMIT`, `AUTH_RATE_LIMIT`, `SESSION_*`, `MAP_*`, `OSRM_*`, etc.

## Deployment (`render.yaml`)

- Two services: `pananexus-api` (Express + Socket.IO) and `pananexus-web` (Next.js).
- Build uses `NODE_ENV=development` for install to include devDependencies; runtime is `production`.
- Health check: `/health`; readiness: `/ready`.
- Migration + verification runs at start (not in `preDeployCommand`) because Prisma CLI must be installed first.
- `STORAGE_DRIVER=s3` is required in production; credentials are `sync: false` (secret env vars, never committed).
- `ADMIN_PASSWORD` must be set in production; never committed.
