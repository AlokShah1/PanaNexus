# PanaNexus — Project Report

## 1. What was built

PanaNexus is an integrated digital healthcare ecosystem connecting patients, doctors, hospitals, health posts, blood/organ donors and emergency dispatch in one platform, delivered as two independently deployable apps:

| App | Stack | Port (dev) |
| --- | --- | --- |
| API | Node 24, Express 5, Socket.IO, Prisma 8 (`@prisma/orm-postgres`), zod, PostgreSQL (local `pn-pg` / Neon) | 4000 |
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
- **100 tests / 16 files** pass (`npm test`), e.g. hours parsing, matching/ranking, intelligence scoring, auth-core, appointment slot logic, and a full HTTP integration suite (`src/routes/api.integration.test.ts`) that boots the app on an ephemeral port and exercises: health, registration/PENDING, license uniqueness, public-directory privacy, login, wrong-password 401, admin approval → Doctor-row sync → VERIFIED → public list **without** license, geo-enriched facilities, emergency create → detail → cancel → double-cancel conflict → unauthenticated 401, blood availability + city filter, notifications authz.
- `npm run typecheck` clean; `npm run build` clean.

### Automated tests — frontend
- **36 tests / 5 files** pass (`npm test`): formatting/roles, hours, verification payloads, API client contract (envelope unwrap, server-message priority, friendly fallbacks, JSON vs FormData headers, network-failure), session role helpers.
- `npm run typecheck`, `npm run lint`, `npm run build` clean.

### Live browser QA (Playwright harness, `/tmp/opencode/shots`)
- `check.js` — **60 route × viewport loads** (desktop/tablet/mobile/narrow across 15 routes): no horizontal overflow, no console errors, no 500s.
- `emergency.js` — full end-to-end: render/font checks, browser geolocation → reverse geocode, pin drag → reset, guest submit → **sign-in prompt**, login with `?next` redirect, request creation, operator accept (API), UI assignment, vehicle + driver + live ETA, polling flips to EN_ROUTE, **live socket proven** (the "Live tracking connected" badge only renders from socket `trip:status` handlers), pin locks during an active trip, responsive across 768/375/320, zero console errors, and a self-cleaning step that completes the trip to free the ambulance. **ALL PASS.**
- The realtime round-trip was hardened: the requester previously subscribed with the emergency **request id** while the server resolved rooms by **trip id**; the server now accepts either id (with owner/operator authorization) and the client re-subscribes when polling confirms a trip — wired and verified live.

### Issues found and fixed during QA
- Global rate limiter exhausted by legitimate QA traffic → made `RATE_LIMIT` env-configurable (was hardcoded 300).
- Auth endpoints (`/auth/*`) saturated by page-load `/auth/me` calls during full-page sweeps → `AUTH_RATE_LIMIT` env-configurable (was hardcoded 30).
- Stale production server on :3000 served an old build → rebuilt, restarted (`next start`).
- 320 px header overflow → `SignOutButton` is icon-only below `sm`; brand wordmark hides below 400 px (logo stays).
- (Earlier) stale `hc_session` cookies from restarted servers caused spurious 401s in smoke tests — re-login flows used in all QA.

## 5. Test creds (dev/demo only)

See `docs/DEPLOY.md`. Seed via `cd backend && npm run seed [-- --demo]`; demo accounts use `TestPass!123` (or `SEED_PASSWORD`).

## 6. Deployment

`render.yaml` (Render Blueprint) + `docs/DEPLOY.md` (Neon + seed + verification workflow). Production cookies are `SameSite=None; Secure`. See also `backend/.env.example` and `frontend/.env.example`.

## 7. Verification (directive checklist)

- [x] Core booking flows (appointments/slots) for patient & doctor
- [x] Emergency matching + live real-time tracking + cancel
- [x] Blood & donor search/matching + facility-side stock/requests
- [x] Records, notifications, feedback, admin analytics/audit/settings
- [x] Admin verification workflow with PENDING → VERIFIED + specialised row sync
- [x] Role-based redirects + guards; guest → sign-in UX on emergency
- [x] No fake data/placeholders; all screens read live API; seeds are real, idempotent facilities + demo accounts
- [x] Backend unit + integration tests, frontend unit tests, browser QA
- [x] Deploy configs (Render), Neon migration/seed plan, env examples, docs