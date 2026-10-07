'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useSession } from '@/lib/session';
import { formatDate } from '@/lib/format';
import { apiErrorMessage } from '@/components/verification/apiError';
import { normalizePayload } from '@/components/verification/format';
import {
  ErrorCard,
  NoRequestCard,
  PanelSkeleton,
  PendingCard,
  RejectedCard,
  SuspendedCard,
  VerifiedCard,
} from '@/components/verification/Cards';
import type { VerificationMe } from '@/components/verification/types';

type PanelState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'suspended' }
  | { phase: 'ready'; data: VerificationMe };

export default function VerificationPanel() {
  const { refresh } = useSession();
  const [state, setState] = useState<PanelState>({ phase: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiGet<VerificationMe>('/verifications/me').then((res) => {
      if (!active) return;
      if (!res.ok) {
        if (res.code === 'ACCOUNT_SUSPENDED') setState({ phase: 'suspended' });
        else setState({ phase: 'error', message: apiErrorMessage(res) });
        return;
      }
      setState({ phase: 'ready', data: res.data });
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function retry() {
    setState({ phase: 'loading' });
    setReloadKey((k) => k + 1);
  }

  function handleSubmitted() {
    setState({ phase: 'loading' });
    setReloadKey((k) => k + 1);
    void refresh();
  }

  if (state.phase === 'loading') return <PanelSkeleton />;
  if (state.phase === 'error') return <ErrorCard message={state.message} onRetry={retry} />;
  if (state.phase === 'suspended') return <SuspendedCard />;

  const { data } = state;
  const request = data.request;
  const payload = normalizePayload(request?.payload);
  const createdLabel = request ? formatDate(request.createdAt) : null;
  const reviewedLabel = request?.reviewedAt ? formatDate(request.reviewedAt) : null;

  if (data.verificationStatus === 'SUSPENDED') return <SuspendedCard />;
  if (data.verificationStatus === 'VERIFIED' || request?.status === 'APPROVED') {
    return <VerifiedCard reviewedLabel={reviewedLabel} />;
  }
  if (data.verificationStatus === 'REJECTED' || request?.status === 'REJECTED') {
    return (
      <RejectedCard
        role={data.role}
        payload={payload}
        reason={request?.reason ?? null}
        documents={request?.documentUrls ?? []}
        onSubmitted={handleSubmitted}
      />
    );
  }
  if (!request) {
    return <NoRequestCard role={data.role} onSubmitted={handleSubmitted} />;
  }
  return (
    <PendingCard
      payload={payload}
      documents={request.documentUrls}
      createdLabel={createdLabel}
    />
  );
}
