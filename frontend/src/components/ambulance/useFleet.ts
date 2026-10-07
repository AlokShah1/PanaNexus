'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { ApiError } from './ui';
import type { AmbulanceRow } from './types';

export function useFleet(authed: boolean, refreshKey: number): { fleet: AmbulanceRow[] | null; error: ApiError | null } {
  const [fleet, setFleet] = useState<AmbulanceRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const res = await apiGet<{ items: AmbulanceRow[] }>('/ambulances/me');
      if (!res.ok) {
        setFleet(null);
        setError(res as ApiError);
        return;
      }
      setFleet(res.data.items);
      setError(null);
    })();
  }, [authed, refreshKey]);

  return { fleet, error };
}