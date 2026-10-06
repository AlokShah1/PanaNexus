'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import {
  IconAmbulance,
  IconDroplet,
  IconEye,
  IconEyeOff,
  IconShield,
  IconStethoscope,
  IconUsers,
  IconHospital,
} from '@/components/icons';

const ROLE_CARDS = [
  { value: 'PATIENT', label: "I'm a patient", Icon: IconUsers },
  { value: 'DOCTOR', label: "I'm a doctor", Icon: IconStethoscope },
  { value: 'FACILITY_STAFF', label: "I'm from a healthcare facility", Icon: IconHospital },
  { value: 'AMBULANCE_OPERATOR', label: "I'm an ambulance provider", Icon: IconAmbulance },
  { value: 'BLOOD_DONOR', label: 'I want to donate blood', Icon: IconDroplet },
  { value: 'ORGAN_DONOR', label: "I want to pledge organs", Icon: IconShield },
];

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('PATIENT');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    const payload: Record<string, string> = {
      email: String(form.get('email') ?? '').trim(),
      password,
    };

    if (mode === 'register') {
      const confirm = String(form.get('confirm') ?? '');
      if (confirm !== password) {
        setFieldError({ field: 'confirm', message: 'Passwords do not match.' });
        setPending(false);
        return;
      }
      payload.name = String(form.get('name') ?? '').trim();
      payload.role = role;
    }

    const res = await apiPost<{ id: string; role: string }>(`/auth/${mode}`, payload);
    if (!res.ok) {
      setError(res.message);
      setPending(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  const input =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-sm transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 outline-none';

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {mode === 'register' && (
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-ink">
            Full name
          </label>
          <input id="name" name="name" required minLength={2} autoComplete="name" placeholder="Your full name" className={input} />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            className={`${input} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </div>
      </div>

      {mode === 'register' && (
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold text-ink">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className={input}
            aria-invalid={fieldError?.field === 'confirm'}
          />
          {fieldError?.field === 'confirm' && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {fieldError.message}
            </p>
          )}
        </div>
      )}

      {mode === 'register' && (
        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold text-ink">What brings you here?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLE_CARDS.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-[0_8px_20px_-12px_rgba(31,69,245,0.8)]'
                      : 'border-slate-200 bg-white text-ink-muted hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-muted'
                    }`}
                  >
                    <r.Icon size={16} />
                  </span>
                  {r.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {mode === 'login' && (
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-ink-muted">
            <input type="checkbox" name="remember" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            Keep me signed in
          </label>
          <span className="text-ink-subtle">Password recovery via support</span>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20">
          {error}
        </p>
      )}

      <button
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_-14px_rgba(31,69,245,0.9)] transition-all duration-200 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {mode === 'login' ? 'Signing in…' : 'Creating account…'}
          </>
        ) : mode === 'login' ? (
          'Sign in'
        ) : (
          'Create account'
        )}
      </button>

      <p className="pt-1 text-center text-sm text-ink-muted">
        {mode === 'login' ? (
          <>
            New to PanaNexus?{' '}
            <Link href="/register" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}