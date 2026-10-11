# PanaNexus — Project Report

## 1. What was built

PanaNexus is an integrated digital healthcare ecosystem connecting patients, doctors, hospitals, health posts, blood/organ donors and emergency dispatch in one platform, delivered as two independently deployable apps:

| App | Stack | Port (dev) |
| --- | --- | --- |
| API | Node 24, Express 4, Socket.IO, Prisma 8 (`@prisma/orm-postgres`), zod, PostgreSQL (local `pn-pg` / Neon) | 4000 |
| Web | Next.js App Router, React 19, TypeScript, Tailwind CSS v4, socket.io-client | 3000 |

## 2. Roles & flows

- **Patient** — emergency request + live trip tracking (WebSocket), appointments (slots, book, cancel), notifications, blood availability search by group + city, medical records viewer, feedback.
- **Doctor** — verification onboarding (PENDING → approved), profile, availability, appointment schedule with status transitions, medical records creation/editing (patient scoping via appointments).
- **Facility staff** — facility profile, blood stock, blood requests (scoped to own facility + own), appointment management.
- **Ambulance operator** — fleet board (server-derived active trips), accept/status/location updates, live broadcasting of `trip:status` + `trip:location`.
- **Admin** — verification queue (approve/reject/request-info), user suspension, audit log, feedback moderation, analytics, settings.

Emergency lifecycle: `PENDING→MATCHED→ASSIGNED→EN_ROUTE→ARRIVED→TRANSPORTING→COMPLETED` (API `state`: REQUESTED/SEARCHING/…) plus `CANCELLED`. Ambulances return to `AVAILABLE` on completion/cancel; double-cancel → 409.

## 3. Architecture & security

- Monorepo: `frontend/`, `backend/`, `shared/` contracts, `backend/prisma/contract.prisma` → emitted `contract.json`/`contract.d.ts`.
- **Auth**: HttpOnly signed cookies (`hc_session`), scrypt password hashing, HMAC-stateless sessions, per-role middleware, `ADMIN` role cannot self-register, reserved admin email blocked, duplicate doctor license → 409 `LICENSE_TAKEN`.
- **Validation**: zod on every body/query at the route boundary; enum options enforced.
- **Real-time**: Socket.IO with cookie/`auth.token` handshake, owned-room subscriptions, `trip:status`/`trip:location` broadcast to requester + operator rooms; polling fallback in the UI.
- **Rate limiting**: global (`RATE_LIMIT`, default 900/15min) + auth limiter (30/15min).
- **Sensitive data**: doctor license/password hashes never serialised; PENDING/REJECTED professionals excluded from public directory; facility staff can only see their own facility's blood requests unless they created them.
- **Uploads**: verification documents to `UPLOAD_DIR`, served under `/verifications/me/documents/…` with authz.
- **The frontend never touches the database** — only the API.

## 4. Verification & QA results

### Automated tests — backend
- **163 passed across 19 files** (`npm test`) on a migrated + seeded database with a bootstrapped admin. Coverage includes hours parsing / timezone conversion / calendar-date matching, matching/ranking, intelligence scoring, auth-core, appointment slot logic, async-error bridge, demo-simulation geometry interpolation, routing-provider route **and geometry** parsing, and a full HTTP integration suite (`src/routes/api.integration.test.ts`) that boots the app on an ephemeral port and exercises: health, registration/PENDING, license uniqueness, public-directory privacy, login, wrong-password 401, admin approval → Doctor-row sync → VERIFIED → public list **without** license, geo-enriched facilities, emergency create → detail → cancel → double-cancel conflict → unauthenticated 401, admission capacity/duplicate/discharge, blood availability + city filter, blood-request facility-spoof prevention, medical-record authoring authorization (relationship guard), medical-record facility scoping + type filter + null-clearing edit, appointment slots independent per calendar date, notifications authz.
- Admin-gated suites self-skip when `ADMIN_EMAIL`/`ADMIN_PASSWORD` are unset or the admin is not bootstrapped; run the migrate → seed → bootstrap steps for full coverage.
- `npm run typecheck` clean; `npm run build` clean.

### Bug found and fixed by re-enabling the admission suite
Enabling the previously-skipped admission suite exposed a **real production bug**: `routes/admissions.ts` called `.count()` directly on a filtered query, which Prisma 8 rejects at runtime (`ORM.INCLUDE_INVALID: count() is only available inside include() refinement callbacks`). Both call sites — the admission capacity check and the transfer target capacity check — now use the supported `aggregate((a) => ({ total: a.count() }))` form. Before the fix, `POST /admissions` returned a 500 in production.

### Automated tests — frontend
- **44 passed across 6 files** (`npm test`): formatting/roles, hours, verification payloads, API client contract (envelope unwrap, server-message priority, friendly fallbacks, JSON vs FormData headers, network-failure), session role helpers.
- `npm run typecheck`, `npm run lint`, `npm run build` clean.

### Browser QA (manual)
There is **no automated browser/e2e harness committed to this repository** (no Playwright/Puppeteer; the earlier `check.js` / `emergency.js` scripts are not present). Browser behaviour — responsive layout (e.g. 375 px), reduced-motion, and loading/empty/error/success/forbidden states — was reviewed **manually** during development and is **not** re-verifiable from the repo. Do not treat viewport/responsive claims as automated coverage.

Known manual-QA findings that were fixed:
- Global rate limiter could be exhausted by page-load traffic → `RATE_LIMIT` is env-configurable.
- Auth endpoints (`/auth/*`) saturated by page-load `/auth/me` calls during full-page sweeps → `AUTH_RATE_LIMIT` env-configurable.
- 320 px header overflow → `SignOutButton` is icon-only below `sm`; brand wordmark hides below 400 px (logo stays).
- (Earlier) stale `hc_session` cookies from restarted servers caused spurious 401s — re-login flows are used in all QA.

### Realtime hardening
The requester previously subscribed with the emergency **request id** while the server resolved realtime rooms by **trip id**. The server now accepts either id (with owner/operator authorization) and the client re-subscribes when polling confirms a trip.

### Demo simulation
When `DEMO_MODE=true`, an admin can run an in-memory ambulance simulation (`/admin/demo/simulate/*`). Movement interpolates constant speed along routing geometry (OSRM, or straight-line flagged `approximate`), emits `trip:location` with `etaMinutes`/`etaApproximate`, and every entity/event is labelled `isSimulation` / "Demo tracking". It never touches production and is torn down on shutdown. See `backend/README.md`.

### CI
`.github/workflows/ci.yml` runs the whole check on every push/PR against a fresh `postgres:16` service and is the reproducible source of truth: backend `db:migrate → db:seed:demo → db:bootstrap → typecheck → test → build`; frontend `npm ci → lint → typecheck → build`.

### Security & correctness hardening (this pass)
- **Async errors**: Express 4 does not forward rejected promises from `async` handlers to the error middleware. `src/lib/asyncErrors.ts` (imported first in `app.ts`) bridges them, so a rejected DB call returns a 500 instead of terminating the whole process.
- **Timezone**: a single fixed product zone (`Asia/Kathmandu`, UTC+5:45, no DST) is a code constant used for slot generation, open/closed checks and display, so behaviour is identical on a UTC host and a developer machine.
- **Authorization tightening**: medical records may only be authored by a doctor with an existing appointment/record relationship; blood requests cannot be attributed to another facility; ambulance fleet status cannot be flipped mid-trip; the emergency PENDING→MATCHED write cannot clobber an operator-set status; admin availability edits require a valid `doctorId`; the duplicated unauthenticated `/appointments/availability` route was removed.
- **Tenant scoping**: facility staff medical-record listings are always scoped to their own facility, so a single in-facility record can no longer expose a patient's records held at other facilities; the `recordType` filter is now applied server-side.
- **Slot correctness**: appointment slot availability is matched by calendar date (product timezone), not weekday, so a booking on another day that shares a weekday no longer hides a genuinely free slot.
- **Editable records**: optional medical-record fields accept `null` to clear, so the edit form no longer fails validation when a field is emptied.
- **Workflow UI correctness**: the records page lists records per selected patient for doctors (matching the server's patient-scoped access instead of an empty/403 list) and the facility console no longer offers the invalid `CONFIRMED→NO_SHOW` transition; paginated panels and notification/message actions surface in-flight state and surface/clear errors; guests are prompted to sign in before booking, checking live blood availability, or registering as a donor instead of hitting a 401.

### Known limitations / backlog (not fixed in this pass)
- **Concurrency**: several check-then-write paths remain non-atomic and only partially protected by unique constraints (blood-unit increments, admission capacity, discharge, doctor/ambulance uniqueness pre-checks). Under concurrent writes these can return 500/409 inconsistently; a transaction, conditional update or DB constraint is recommended.
- **Broad operator read scope**: a verified ambulance operator can read any emergency request by id. The public `GET /` list already exposes open requests; tightening to "open OR assigned to my fleet" is recommended but was deferred to avoid changing the operator-marketplace semantics.
- Some sensitive routes omit `requireVerified`; some list endpoints do N+1 / unbounded in-memory queries (acceptable at demo scale).
- **Storage**: S3/Filebase production upload/download and denied-access paths are unverified (no production credentials). `STORAGE_DRIVER=s3` is still required in production (fails safe). Backup/restore verified locally only.
- **No browser/e2e harness**: responsive layout (375 px), reduced-motion, and loading/empty/error/success/forbidden screens are not automatically verified.

## 5. Test creds (dev/demo only)

See `docs/DEPLOY.md`. Seed facilities with `cd backend && npm run seed`. Synthetic demo accounts require `DEMO_MODE=true` (dev/demo only) via `DEMO_MODE=true npm run seed -- --demo`, use the reserved `@pananexus.local` domain, and print one-time credentials (password from `DEMO_PASSWORD`, else generated).

## 6. Deployment

`render.yaml` (Render Blueprint) + `docs/DEPLOY.md` (Neon + migrations + seed + verification workflow). Production cookies are `SameSite=None; Secure`. See also `backend/.env.example` and `frontend/.env.example`.

Schema lifecycle (Prisma 8 migrations, not startup auto-sync):

- Migrations are authored from `contract.prisma` (`prisma migration plan`), committed to git under `backend/migrations/app/`, and replayed to the database with `prisma db migrate` (replay-only, idempotent).
- The commit baseline (`20261007T0416_baseline`) creates all 20 tables + indexes/constraints from empty (99 operations); the full set is **9 migrations / 146 operations** and was replayed cleanly onto a fresh database (`pananexus_ci`) as part of CI-parity validation, after which `db:verify` reports the contract matches and re-running reports "nothing to run".
- Migration + schema verification run inside the API's start chain: `npm start` → npm `prestart` (`prisma db migrate` then `prisma db verify`) → `node dist/src/server.js`. Render startCommand is `cd backend && npm start`, so every boot is install → build → migrate → verify → admin bootstrap → listen. Render `preDeployCommand` is intentionally **not** used — it executes before the build installs `node_modules`, so the Prisma CLI is unavailable there (the original cause of the `relation "public.User" does not exist` on Neon).
- The server refuses to boot against an uninitialized schema (pre-boot `User` table probe with an actionable error) — a fail-fast guard, not a silent `db push`.
- Admin auto-bootstrap runs after the schema check and is idempotent (promotes or creates `ADMIN_EMAIL`; never logs the password).

## 7. Verification (directive checklist)

- [x] Core booking flows (appointments/slots) for patient & doctor
- [x] Emergency matching + live real-time tracking + cancel
- [x] Blood & donor search/matching + facility-side stock/requests
- [x] Records, notifications, feedback, admin analytics/audit/settings
- [x] Admin verification workflow with PENDING → VERIFIED + specialised row sync
- [x] Role-based redirects + guards; guest → sign-in UX on emergency
- [x] No fake data/placeholders; all screens read live API; seeds are real, idempotent facilities + demo accounts
- [x] Backend unit + integration tests (163, incl. admission integrity + authorization), frontend unit tests (44)
- [x] Manual browser review (responsive + states) — automated e2e harness is not committed
- [x] Design system documented (`docs/design-system.md`) + duplicated UI primitives consolidated
- [x] Demo-only ambulance simulation with clearly-labelled synthetic tracking
- [x] Deploy configs (Render), Neon migration/seed plan, env examples, docs
- [x] CI workflow for a clean-database backend + frontend check