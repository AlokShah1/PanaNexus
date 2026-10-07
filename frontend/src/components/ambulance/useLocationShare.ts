'use client';

import { useEffect, useState } from 'react';
import { apiPost } from '@/lib/api';
import { failText } from './ui';

export type LocState = {
  status: 'idle' | 'sharing' | 'denied' | 'unsupported' | 'blocked' | 'error';
  message: string | null;
  sent: number;
};

export function useLocationShare(ambulanceId: string | null, enabled: boolean): LocState {
  const [state, setState] = useState<LocState>({ status: 'idle', message: null, sent: 0 });

  useEffect(() => {
    if (!ambulanceId || !enabled) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      void (async () => {
        setState({ status: 'unsupported', message: 'Live location is not supported in this browser.', sent: 0 });
      })();
      return;
    }
    let last = 0;
    let active = true;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last < 2000) return;
        last = now;
        setState((s) => ({ ...s, status: 'sharing', message: null }));
        void apiPost<{ accepted: boolean; throttled: boolean }>(`/ambulances/${encodeURIComponent(ambulanceId)}/location`, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).then((res) => {
          if (!active) return;
          if (res.ok) {
            setState((s) => ({ ...s, sent: s.sent + (res.data.accepted ? 1 : 0) }));
          } else {
            setState((s) => ({ ...s, status: 'error', message: failText(res) }));
          }
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission is off. Enable it in your browser to share live coordinates.'
              : 'Live location is unavailable right now.',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [ambulanceId, enabled]);

  return state;
}