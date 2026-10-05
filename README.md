# Integrated Digital Healthcare Ecosystem

One lightweight platform connecting patients, doctors, hospitals, health posts, blood/organ donors, and emergency services.

## Stack
- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript (strict)
- Tailwind CSS v4
- Prisma 8 ORM (`@prisma/orm-postgres`) + Neon PostgreSQL
- Vitest for unit tests

## Setup
1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL` (Neon), and `AUTH_SECRET`.
2. Install dependencies: `npm install`
3. Emit the data contract: `npx prisma contract emit`
4. Sync the database schema: `npx prisma db init` (uses `DIRECT_URL`)
5. Start the dev server: `npm run dev`

## Scripts
- `npm run dev` — start the dev server
- `npm run build` / `npm start` — production build/serve
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit tests
- `npm run contract:emit` — regenerate `contract.json` / `contract.d.ts`

## Deployment (Render)
Set these environment variables in your Render service:
- `DATABASE_URL` — Neon pooled connection string
- `DIRECT_URL` — Neon direct connection string (for Prisma CLI ops)
- `AUTH_SECRET` — long random secret

Build command: `npm install && npm run build`
Start command: `npm start`

Once the env vars are set, initialize the database schema once:
`npx prisma db update` (quick dev sync) or `npx prisma migration plan && npx prisma db migrate` (migration history).

## Structure
- `src/app` — routes (public site, auth, dashboard, APIs)
- `src/components` — shared UI
- `src/lib` — auth/session, API helpers
- `src/validations` — Zod schemas
- `src/prisma` — Prisma 8 data contract + client

## Authorization model
Role-based access control enforced on the server. Sessions are signed HttpOnly cookies (`AUTH_SECRET`). Every protected operation must validate the session server-side. Medical records are never exposed publicly.
