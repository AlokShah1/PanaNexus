'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost } from '@/lib/api';

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await apiPost<{ loggedOut: true }>('/auth/logout', {});
    } finally {
      setPending(false);
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={signOut} disabled={pending} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
