import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconArrow } from './icons';

/* ---------------------------------------------------------------- button */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'emergency' | 'dark';

const BTN: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_10px_30px_-12px_rgba(31,69,245,0.7)] hover:bg-brand-700 hover:shadow-[0_14px_36px_-12px_rgba(31,69,245,0.75)]',
  secondary:
    'bg-white text-brand-700 ring-1 ring-brand-200 hover:ring-brand-400 hover:bg-brand-50',
  ghost: 'text-ink-muted hover:text-brand-700 hover:bg-brand-50',
  emergency:
    'bg-danger text-white shadow-[0_10px_30px_-12px_rgba(225,29,72,0.65)] hover:bg-[#c01039] hover:shadow-[0_14px_36px_-12px_rgba(225,29,72,0.7)]',
  dark: 'bg-ink text-white hover:bg-brand-900',
};

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link href={href} className={`${BTN_BASE} ${BTN[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BTN_BASE} ${BTN[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- badge */
type Tone = 'brand' | 'teal' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  teal: 'bg-teal-500/10 text-teal-600 ring-teal-500/25',
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  danger: 'bg-danger-soft text-danger ring-danger/25',
  neutral: 'bg-slate-100 text-ink-muted ring-slate-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'success' }: { tone?: 'success' | 'warning' | 'danger' | 'brand' }) {
  const color =
    tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : tone === 'brand' ? 'bg-brand-500' : 'bg-success';
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

/* ------------------------------------------------------------ section head */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
          <span className="h-px w-6 bg-brand-300" />
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ decor */
export function Blob({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${className}`}
    />
  );
}

export function CrossMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={`pointer-events-none absolute ${className}`}>
      <path
        d="M38 6h24v32h32v24H62v32H38V62H6V38h32z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WaveDivider({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={`block h-[60px] w-full text-white ${flip ? 'rotate-180' : ''}`}
    >
      <path fill="currentColor" d="M0 40c180 40 360 55 540 40s360-70 540-60 300 55 360 70v0H0V40Z" />
    </svg>
  );
}

/* ------------------------------------------------------------ misc blocks */
export function LinkArrow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
    >
      {children}
      <IconArrow size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
    </Link>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent ${className}`}
    />
  );
}