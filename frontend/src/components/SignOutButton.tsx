'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/session';

export default function SignOutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { signOut } = useSession();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut();
    } finally {
      setPending(false);
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:px-3 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      <span className="hidden sm:inline">{pending ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}