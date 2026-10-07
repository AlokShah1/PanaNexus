# PanaNexus — Demo Accounts

All demo credentials below are synthetic and for presentation/testing only.
They are seeded only when `DEMO_MODE=true` (see `backend/.env` for local use).

| Role | Email | Password |
|------|-------|----------|
| Patient | `patient.demo@pananexus.local` | `TestPass!123` |
| Doctor | `doctor.demo@pananexus.local` | `TestPass!123` |
| Facility | `facility.demo@pananexus.local` | `TestPass!123` |
| Ambulance operator | `ambulance.demo@pananexus.local` | `TestPass!123` |

| Role | Email | Password |
|------|-------|----------|
| Platform admin | use the real configured `ADMIN_EMAIL` | (real — never committed) |

Synthetic credentials use the `@pananexus.local` domain and carry identifiers such as
`DEMO-DOC-2026-001`. They are not real licences, emails, phones, or identities.

## Commands

```bash
npm run db:seed        # seed facilities + full synthetic dataset
npm run db:seed:demo   # same
npm run db:reset:demo  # clear synthetic rows only and re-seed
```

`db:reset:demo` only touches rows identified as demo/synthetic (the `@pananexus.local`
domain plus the `demo.data.ledger` PlatformSetting). It must never delete real data.
