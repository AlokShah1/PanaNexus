# PanaNexus Design System

Canonical reference for the frontend's visual language and reusable UI. Every
new screen should reuse these tokens and primitives rather than inventing local
styles. Anything not covered here (new color, radius, shadow, animation) must be
added to `frontend/src/app/globals.css` **and** documented in this file in the
same change.

## Source of truth

| Concern | File |
|---|---|
| Design tokens (color, radius, shadow, motion) | `frontend/src/app/globals.css` (`:root` + `@theme inline`) |
| Marketing / general primitives | `frontend/src/components/ui.tsx` |
| Dashboard shell primitives | `frontend/src/components/dashboard/ui.tsx` |
| Icons | `frontend/src/components/icons.tsx` |

> Dashboard primitives previously lived in four identical copies
> (`components/{admin,doctor,facility,ambulance}/ui.tsx`). They are now a single
> module at `components/dashboard/ui.tsx`; import from
> `@/components/dashboard/ui`.

## Principles

1. **Calm, trustworthy, healthcare-grade.** Blue-forward (`brand`) with a teal
   accent. No decoration for decoration's sake.
2. **Honest UI.** Never imply certainty we don't have — an approximated route,
   simulated trip, or unverified professional is always labelled as such.
3. **Accessible by default.** Visible focus rings, ≥4.5:1 body contrast,
   `prefers-reduced-motion` respected, never a horizontal scrollbar.
4. **No emoji as icons.** Use `components/icons.tsx` (line SVGs). Emoji may only
   appear as literal user content.
5. **Consistent states.** Every data view handles loading, empty, error, success,
   and forbidden — using the primitives below.

## Color tokens

Defined in `globals.css` and exposed to Tailwind via `@theme inline` (e.g.
`bg-brand-600`, `text-ink-muted`).

| Token | Value | Use |
|---|---|---|
| `--surface` | `#f5f9fd` | App background |
| `--surface-raised` | `#ffffff` | Cards / raised panels (`bg-raised`) |
| `--ink` | `#0a1a33` | Primary text |
| `--ink-muted` | `#4a5f7d` | Secondary text |
| `--ink-subtle` | `#7b8ea8` | Tertiary / captions |
| `--brand-50…900` | `#eef4ff → #1c2c92` | Primary action + brand surfaces |
| `--teal-300…600` | `#5eead4 → #0d9488` | Secondary accent |
| `--success` | `#16a34a` | Success |
| `--warning` | `#d97706` | Warning |
| `--danger` | `#e11d48` | Danger / emergency |
| `--danger-soft` | `#fff1f4` | Danger surface |

Use of decorative backdrops (`.bg-grid`, `.bg-dots-fine`, `.bg-mesh`,
`.text-gradient`) is limited to marketing/hero surfaces. Dashboard and form
surfaces use flat `bg-white` / `bg-slate-50` panels.

## Typography

- Single typeface: **Inter** (`--font-inter`), system stack fallback.
- Base `16px` / `1.55`; headings `700` with `-0.018em` tracking and
  `text-wrap: balance`.
- `font-feature-settings: "cv02","cv03","cv04","cv11"` is applied on `body`.
- Body copy typically `text-sm` / `text-[13px]`; captions `text-[11px]`.

## Radius, shadow, motion

| Token | Tailwind |
|---|---|
| `--radius-sm` `10px` | `rounded-[10px]` |
| `--radius-md` `16px` | `rounded-2xl` |
| `--radius-lg` `24px` | `rounded-3xl` |
| `--radius-xl` `32px` | `rounded-[32px]` |
| `--shadow-soft` | `shadow-soft` (resting cards) |
| `--shadow-lift` | `shadow-lift` (hero / emphasis) |
| `--shadow-glow` | `shadow-glow` (focus/hero accent) |

Motion: `animate-float`, `-float-slow`, `-fade-up[-delay[-2]]`, `-pulse-ring`,
`-dash`, `-drift`, `-blink`. All are disabled under
`@media (prefers-reduced-motion: reduce)` — do not bypass that block.

## Primitives

### `components/ui.tsx`

- **`Button` / `ButtonLink`** — variants: `primary`, `secondary`, `ghost`,
  `emergency`, `dark`. Pill shape, `active:scale-[0.98]`, disabled state built in.
  Use `emergency` (danger) only for genuine emergency actions.
- **`Badge`** — tones: `brand`, `teal`, `success`, `warning`, `danger`, `neutral`.
- **`StatusDot`** — tones: `success` (default), `warning`, `danger`, `brand`.
- **`SectionHeading`** — `eyebrow`, `title`, `description`, `align`.
- **Decor** — `Blob`, `CrossMark`, `WaveDivider` (marketing only).
- **`LinkArrow`**, **`Divider`**.

### `components/dashboard/ui.tsx`

- **`Card`** — titled panel; `title`, `description`, `actions`, `children`.
- **`ErrorBanner`** — maps API errors via `failText`, optional retry.
- **`SuccessNotice`** — inline success feedback.
- **`Empty`** — empty state with icon/title/hint.
- **`Skeleton` / `PageSkeleton`** — loading placeholders (`aria-busy`).
- **`Pager`** — pagination footer backed by `PageMeta`.
- **`Guest`** — unauthenticated gate.
- **`WrongRole`** — role-mismatch gate.
- **`VerificationBanner`** — unverified/suspended/rejected professional notice.
- **Helpers** — `failText(error)`, `fmtDateTime(iso)`, `blockReason(profile)`.

## Data-view state checklist

Every component that fetches data must render all of these, and the fetch
callback must inspect `res.ok` (the API client resolves `{ ok: false }` rather
than throwing):

1. **Loading** — `Skeleton` (or an inline `aria-busy` placeholder). Never render
   the empty state before the first response resolves.
2. **Empty** — `Empty`, only after a successful response returned zero rows.
3. **Error** — `ErrorBanner` with a working retry. Retry must actually re-run the
   fetch (a reload key/token or a new page value), never a no-op `setState`.
4. **Success** — render only from confirmed API data; optimistic updates must
   check `ok` first.
5. **Forbidden/conflict** — surface 403/409/422 messages; do not collapse them
   into the generic empty or the network-error copy.

## Rules for new UI

1. Reuse a primitive before writing markup; extend the primitive if a variant is
   genuinely reusable.
2. Keep decoration sparse. At most one backdrop treatment per marketing section;
   never on dashboards or forms.
3. Always label non-certainty: `approximate` routes, `isSimulation` trips
   ("Demo tracking"), and unverified accounts.
4. Provide focus-visible styling (inherited globally) and keyboard access.
5. Verify the layout at 375px width and with reduced motion enabled.
6. No emoji icons; no gradients on text smaller than headings; no unused
   animation tokens.
