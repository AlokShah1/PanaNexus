import type { ApiResult } from '@/lib/api';

type ApiFailure = Extract<ApiResult<unknown>, { ok: false }>;

export function apiErrorMessage(res: ApiFailure): string {
  if (res.code === 'EMAIL_RESERVED') return 'This email is reserved for administrators.';
  if (res.code === 'LICENSE_TAKEN') return 'That license number is already registered by another doctor.';
  return res.message;
}
