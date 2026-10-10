# PanaNexus Frontend

Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4 · `socket.io-client`.

The frontend is a thin typed client. All authentication, authorization, data persistence, and real-time events are handled server-side by the backend (`backend/src/app.ts` and `routes/`). Pages use client components for forms and sockets; server components render static/initial content.

## Setup

```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000 (dev) or https://pananexus-api.onrender.com (production).
npm install
npm run dev     # http://localhost:3000
npm run build
npm run start
npm run typecheck
npm run lint
npm test
```

## Dependencies (selected)

- `next` (App Router): routing, SSR, static generation.
- `react` 19: component framework.
- `tailwindcss` v4: styling (`globals.css`).
- `socket.io-client`: realtime connections (`lib/realtime.ts`).
- `leaflet` (map components), `zod`: validation helpers.

## Component and page structure

- `src/app/login`, `register`: auth screens.
- `src/app/dashboard`: patient/doctor/staff/ambulance/admin landing.
- `src/app/ambulance`: dispatch board (`DispatchBoard.tsx`), emergency request form (`EmergencyRequestForm.tsx`), trip tracking.
- `src/app/appointments`, `doctors`, `patients`: appointment booking, doctor profiles, patient records.
- `src/app/emergency`: emergency request creation and live tracking.
- `src/app/facility`, `hospitals`, `health-posts`: facility search and bed capacity.
- `src/app/messages`, `notifications`: messaging and system notifications.
- `src/app/admin`: verification approvals, analytics, settings.
- `src/app/records`: medical record access and upload.
- `src/components/admin`, `ambulance`: reusable admin components and ambulance UI.
- `src/lib/api.ts`: single API client (`fetch` with cookie header); handles auth, errors, session refresh.
- `src/lib/realtime.ts`: socket singleton (`getRealtime()`); event types (`TripStatusEvent`, `TripLocationEvent`).
- `src/lib/session.ts`: session helpers (cookie extraction, profile refresh).

## Authentication state

Cookies (`Cookie` header) contain `hc_session`; the API validates session server-side (`touchSession`). Client reads session via `GET /api/v1/auth/me`. No JWT or local token storage; session stateless on server, signed with `AUTH_SECRET`.

## Real-time

`socket.io-client` connects to the backend Socket.IO server. Events: `trip:status`, `trip:location`, `emergency:new`. The `DispatchBoard` subscribes to `emergency:new`; `EmergencyRequestForm` subscribes to `trip:status` and `trip:location` using the request/ID.

## Environment variables

- `NEXT_PUBLIC_API_URL`: public API origin (baked into bundle; must point at deployed API).
- `NODE_ENV`: `development`, `test`, `production`.
