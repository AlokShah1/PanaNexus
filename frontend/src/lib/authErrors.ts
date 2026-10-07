import { NETWORK_ERROR_MESSAGE, type ApiResult } from './api';

type ApiFailure = Extract<ApiResult<unknown>, { ok: false }>;

const BY_CODE: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_SUSPENDED: 'This account has been suspended.',
  VERIFICATION_PENDING: 'Your account is awaiting verification.',
  ACCOUNT_PENDING: 'Your account is awaiting verification.',
  EMAIL_RESERVED: 'This email is reserved for administrators.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  LICENSE_TAKEN: 'That license number is already registered by another doctor.',
};

export function authErrorMessage(res: ApiFailure, mode: 'login' | 'register'): string {
  if (res.status === 0) return NETWORK_ERROR_MESSAGE;
  if (res.code && BY_CODE[res.code]) return BY_CODE[res.code];
  if (res.status < 500 && res.message) return res.message;
  return mode === 'register'
    ? 'Unable to create your account. Please try again.'
    : NETWORK_ERROR_MESSAGE;
}