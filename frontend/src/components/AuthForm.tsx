'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { isProRole, useSession, type SessionProfile } from '@/lib/session';
import { ButtonLink } from '@/components/ui';
import { authErrorMessage } from '@/lib/authErrors';
import { Field, REGISTER_FIELDS, inputClass } from '@/components/verification/fields';
import {
  IconAmbulance,
  IconCheck,
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

const LOGIN_HOME: Record<string, string> = {
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  AMBULANCE_OPERATOR: '/ambulance',
  FACILITY_STAFF: '/facility',
};

function safeNext(value: string | null, fallback: string): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('PATIENT');
  const [created, setCreated] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
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
      const name = String(form.get('name') ?? '').trim();
      if (name.length < 2) {
        setFieldError({ field: 'name', message: 'Enter your full name (at least 2 characters).' });
        setPending(false);
        return;
      }
      if (password.length < 8) {
        setFieldError({ field: 'password', message: 'Password must be at least 8 characters.' });
        setPending(false);
        return;
      }
      const roleFields = REGISTER_FIELDS[role] ?? [];
      for (const def of roleFields) {
        const value = String(form.get(def.name) ?? '').trim();
        if (def.required && value.length < (def.minLength ?? 1)) {
          setFieldError({ field: def.name, message: `${def.label} is required.` });
          setPending(false);
          return;
        }
        if (value.length > 0 && def.minLength && value.length < def.minLength) {
          setFieldError({ field: def.name, message: `${def.label} must be at least ${def.minLength} characters.` });
          setPending(false);
          return;
        }
      }
      payload.name = name;
      payload.role = role;
      for (const def of roleFields) {
        const value = String(form.get(def.name) ?? '').trim();
        if (value) payload[def.name] = value;
      }
    }

    const res = await apiPost<{ profile: SessionProfile }>(`/auth/${mode}`, payload);
    if (!res.ok) {
      setError(authErrorMessage(res, mode));
      setPending(false);
      return;
    }
    await refresh();
    const nextParam = new URLSearchParams(window.location.search).get('next');

    if (mode === 'register' && isProRole(res.data.profile.role)) {
      setCreated(true);
      setPending(false);
      return;
    }
    const fallback = mode === 'register' ? '/dashboard' : LOGIN_HOME[res.data.profile.role] ?? '/dashboard';
    router.push(safeNext(nextParam, fallback));
    router.refresh();
  }

  if (created) {
    return (
      <div
        role="status"
        className="rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-200/70 sm:p-8"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
          <IconCheck size={22} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">Account created — pending verification</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Your professional verification request has been submitted. We will review it shortly; head to
          the verification page to upload your credentials so an admin can approve you.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <ButtonLink href="/verification" className="w-full">
            Continue to verification
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="w-full">
            Go to sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {mode === 'register' && (
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-ink">
            Full name
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            placeholder="Your full name"
            className={inputClass}
            aria-invalid={fieldError?.field === 'name'}
          />
          {fieldError?.field === 'name' && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {fieldError.message}
            </p>
          )}
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
          maxLength={160}
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
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
            maxLength={128}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            className={`${inputClass} pr-11`}
            aria-invalid={fieldError?.field === 'password'}
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
        {fieldError?.field === 'password' && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
            {fieldError.message}
          </p>
        )}
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
            maxLength={128}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className={inputClass}
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
                  onClick={() => {
                    setRole(r.value);
                    setFieldError(null);
                  }}
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

      {mode === 'register' && REGISTER_FIELDS[role] && (
        <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Professional details</legend>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            These details are reviewed by our team before your professional account is verified.
          </p>
          <div className="mt-3 space-y-4" onChange={() => setFieldError(null)}>
            {REGISTER_FIELDS[role].map((def) => (
              <Field
                key={def.name}
                def={def}
                error={fieldError?.field === def.name ? fieldError.message : null}
              />
            ))}
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
