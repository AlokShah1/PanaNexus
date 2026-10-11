# PanaNexus Backend

Express 4 + Socket.IO + Prisma 8 (`@prisma/orm-postgres`) over PostgreSQL. All routes use zod validation; middleware enforces auth/role/verification; rate limits apply globally and on auth routes. (Express 4 does not forward rejected promises from `async` handlers to the error middleware, so `src/lib/asyncErrors.ts` is imported first in `app.ts` to bridge them — otherwise an unhandled rejection would terminate the process.)

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
- `lib/storage.ts`: `StorageAdapter` interface; `local` driver (`localReportsDir`, signed download tokens with HMAC); `s3` adapter (AES256 server-side encryption, `S3Client` with optional explicit credentials, `PutObjectCommand`/`DeleteObjectCommand`/`HeadObjectCommand`/`GetObjectCommand` via `@aws-sdk/s3-request-presigner`). Production requires `STORAGE_DRIVER=s3` with `S3_REGION`, `S3_BUCKET`, and `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` paired; missing vars cause safe startup failure (`env.ts`).
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
- Sensitive production info never exposed: `productionStorageError` names missing variables (e.g., `S3_REGION`, `S3_BUCKET`) without values; cookie settings never expose `AUTH_SECRET`.

## Health and readiness

- `GET /health` returns `{ status: 'ok' }` (always).
- `GET /ready` queries `public.User` via DB; returns `{ status: 'ready' }` (200) or `{ status: 'not ready', reason: 'database' }` (503) on DB failure.
- Startup sequence (`npm start`): `prestart` (`db:migrate` + `db:verify`) then `node dist/src/server.js`. If DB is unready, server fails fast with an actionable message.

## Tests

Run `npm test`. Current: **163 passed across 19 files** on a migrated + seeded database with a bootstrapped admin. Integration tests need a migrated database and, for full coverage, seeded demo data plus a bootstrapped admin (see the CI steps); without those, the admin-gated suites self-skip.

```bash
docker start pn-pg                 # local Postgres
npm run db:migrate                 # apply committed migrations
DEMO_MODE=true npm run db:seed:demo   # synthetic dataset the suite assumes
ADMIN_PASSWORD=TestPass!123 npm run db:bootstrap   # admin for admin-gated routes
npm test
```

- Integration (`api.integration.test.ts`): HTTP suite covering auth, verification, emergency lifecycle, patient resources, private medical reports, facility bed capacity, appointment availability/booking integrity, ambulance dispatch integrity, session revocation, messaging, analytics.
- Unit (`lib/*.test.ts`, `config/*`): `auth`, `auth-core`, `demoData`, `demoSimulation` (marker interpolation), `hours`, `appointments`, `dispatch`, `maps` (nominatim + osrm route **and geometry**), `discovery`, `geo`, `blood`, `matching`, `intelligence`, `notification`, `env`.
- Admission integrity: verifies capacity checks, duplicate-admission rejection, discharge, and repeat-discharge conflict via the real HTTP route (a bootstrapped admin approves a facility, which provisions its facility + staff linkage).

### Test gating

`routes/api.integration.test.ts` gates on the environment so it degrades cleanly without a database:

- an env/db readiness gate (`ok ? describe : describe.skip`) — the whole file skips when the database is not migrated;
- `describe.skipIf(adminJar === '' || !dbOk)` around admin-only suites (verification approval, ambulance dispatch, admission, bed capacity, revocation, messaging, appointments) — they run only when `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set and `db:bootstrap` has run.

Run the gated suites locally with the migrate → seed → bootstrap steps above.

## Demo simulation

When `DEMO_MODE=true`, the admin surface exposes an in-memory, demo-only ambulance simulation. It never writes to production and every emitted event/entity is labelled `isSimulation` / "Demo tracking" so the UI can distinguish it from real traffic.

- `GET  /admin/demo/simulations` — active simulations.
- `POST /admin/demo/simulate/start` — start a trip from a request (returns a `Simulation`).
- `POST /admin/demo/simulate/pause|resume|stop|reset` — control a running simulation.
- Movement interpolates a constant speed along a routing-provider geometry (`osrm`, or a straight-line fallback flagged `approximate`); ticks update ambulance position + `LocationUpdate` and emit `trip:location` with `etaMinutes` and `etaApproximate`.
- All simulations are stopped on `SIGTERM`/`SIGINT` alongside the dispatch loop.

## Timezone handling

The platform serves a single timezone: **Asia/Kathmandu (NPT, UTC+5:45)**, which
observes no daylight saving. This is a code-level constant (`src/lib/hours.ts`),
not a `TZ` environment variable, so slot generation is deterministic regardless
of the host's clock zone.

- Facility operating hours are parsed as wall-clock ranges (`Mon–Sat 08:00–20:00`).
- `zoneWallClockToUtc(...)` converts a local wall-clock date/minute to the correct
  UTC instant (e.g. 09:00 NPT → 03:15 UTC).
- `nowZone()` / `isOpenNow()` evaluate "is this open now" in NPT.
- Appointments store ISO-8601 UTC instants; the weekday and minute-of-day checks
  (`appointments.ts`) and the client display (`frontend/src/lib/format.ts`) all use
  the same NPT zone, so booking, slot generation and display agree.
- Notifications format times with `Asia/Kathmandu` too.

Unit tests cover the offset conversions, early-morning day roll-over, and the
round-trip (`src/lib/hours.test.ts`); the appointment integration suite asserts
slots are generated from NPT wall-clock time rather than server local time.

## Environment variables

See `.env.example`. Key variables explained:
- `DATABASE_URL` (required, pooled, runtime) and `DIRECT_URL` (optional, unpooled, migrations/verify).
- `AUTH_SECRET` (required, min 16 chars, signs session cookies).
- `FRONTEND_URL` (required in production; CORS origin; fail-fast if missing).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (admin auto-bootstraps; `ADMIN_PASSWORD` required and min 8 chars in production; missing = startup failure).
- `DEMO_MODE` (default `false`; `true` enables destructive demo seeding/reset; production rejects if `true`).
- `NODE_ENV`: `development` (cookies `SameSite=None; Secure` — requires HTTPS via `lvh.me`/`mkcert`), `test` (rate limits disabled), `production` (`SameSite=None`/secure cookies; requires S3; rejects `DEMO_MODE=true`).
- `STORAGE_DRIVER`: `local` (dev/default) or `s3` (production; requires `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; production fails safe without them).
- `S3_ENDPOINT`: Optional custom S3 endpoint (e.g., `https://s3.filebase.com` for Filebase). If unset, uses AWS default endpoint.
- `PORT`, `RATE_LIMIT`, `AUTH_RATE_LIMIT`, `SESSION_*`, `MAP_*`, `OSRM_*`, etc.

There is **no `TZ` environment variable**: the product timezone is a fixed constant
(`Asia/Kathmandu`, UTC+5:45, no DST) defined in `src/lib/hours.ts`. Facility hours
and appointment slots are authored and evaluated in that zone, not the server's
local zone, so behaviour is identical on a UTC host (Render) and a developer
laptop. See “Timezone handling" below.

## Filebase Configuration (S3-compatible)

For development and testing, Filebase provides a free-tier S3-compatible object store:

1. **Create a Filebase account** at https://filebase.com/ and create a bucket (e.g., `pananexus-medical-reports`).
2. **Generate access keys** in the Filebase dashboard (Access Keys → Create Access Key).
3. **Configure environment variables**:
   ```bash
   STORAGE_DRIVER=s3
   S3_REGION=us-east-1
   S3_BUCKET=pananexus-medical-reports
   S3_ENDPOINT=https://s3.filebase.com
   S3_ACCESS_KEY_ID=<your-filebase-access-key>
   S3_SECRET_ACCESS_KEY=<your-filebase-secret-key>
   ```
3. **Free tier limits**: 5 GB storage, 1 GB/month egress, 100,000 requests/month.
4. **Bucket must remain private** — Filebase buckets are private by default; never enable public access.
5. **CORS**: Add a bucket CORS rule in Filebase dashboard if browser fetches presigned URLs directly:
   ```json
   [
     { "AllowedMethods": ["GET"], "AllowedOrigins": ["https://<your-web-host>"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }
   ]
   ```

## Deployment (`render.yaml`)
