# PanaNexus — Integrated Digital Healthcare Ecosystem

A lightweight platform connecting patients, doctors, hospitals, health posts, blood/organ donors, and emergency services. Built as two independently deployable apps:

- **frontend** — Next.js + React + TypeScript + Tailwind CSS
- **backend** — Node.js + Express + Prisma 8 ORM + Neon PostgreSQL

## Directory

```
frontend/   Next.js app (UI)
  src/app/        pages + layouts (client components call the API via rewrites)
  src/components/ UI components
backend/  Express API + Prisma
  src/config/    env validation
  src/lib/       auth, matching, blood logic, intelligence, analytics
  src/middleware/ (not yet abstracted)
  src/routes/    REST controllers grouped by resource
  src/validations/ zod schemas
  prisma/        contract.prisma (Prisma 8), db.ts, emitted contract.json/contract.d.ts
shared/types|constants|schemas   safe contracts (no Prisma/secrets)
```

## Environment

**backend/.env**
```
DATABASE_URL=<neon pooled url>
DIRECT_URL=<neon direct url>
AUTH_SECRET=<long random secret>
PORT=4000
FRONTEND_URL=http://localhost:3000
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Development
```bash
# backend
cd backend
npm install
npx prisma contract emit
npm run dev

# frontend
cd frontend
npm install
npm run dev
```

## Checks
```bash
cd backend && npm run typecheck && npm run lint && npm test && npm run build
cd frontend && npm run typecheck && npm run lint && npm run build
```

## Security note
Sessions are signed HttpOnly cookies set by the backend. Every protected API validates the session and role server-side; the frontend never touches the database.




