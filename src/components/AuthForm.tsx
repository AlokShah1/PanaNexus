'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ROLES = ['PATIENT', 'DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR', 'BLOOD_DONOR', 'ORGAN_DONOR', 'ADMIN'] as const;

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = { email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') };
    if (mode === 'register') {
      payload.name = String(form.get('name') ?? '');
      payload.role = String(form.get('role') ?? 'PATIENT');
    }
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Something went wrong.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">{mode === 'login' ? 'Login' : 'Create account'}</h1>
      {mode === 'register' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input name="name" required minLength={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input name="email" type="email" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <input name="password" type="password" required minLength={mode === 'register' ? 8 : 1} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {mode === 'register' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select name="role" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}
      </button>
      <p className="text-sm text-slate-600">
        {mode === 'login' ? (
          <>New here? <Link href="/register" className="font-medium text-slate-900 underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="font-medium text-slate-900 underline">Login</Link></>
        )}
      </p>
    </form>
  );
}
