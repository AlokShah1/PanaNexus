import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './authErrors';
import type { ApiResult } from './api';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

const failure = (over: Partial<Failure>): Failure =>
  ({ ok: false as const, status: 500, message: 'fallback', ...over });

describe('authErrorMessage', () => {
  it('maps network failures to the connection message for both modes', () => {
    expect(authErrorMessage(failure({ status: 0 }), 'login')).toBe(
      "We're having trouble connecting right now. Please try again.",
    );
    expect(authErrorMessage(failure({ status: 0 }), 'register')).toBe(
      "We're having trouble connecting right now. Please try again.",
    );
  });

  it('maps INVALID_CREDENTIALS to the login message', () => {
    expect(authErrorMessage(failure({ status: 401, code: 'INVALID_CREDENTIALS' }), 'login')).toBe(
      'Invalid email or password.',
    );
  });

  it('maps ACCOUNT_SUSPENDED for both modes', () => {
    expect(authErrorMessage(failure({ status: 403, code: 'ACCOUNT_SUSPENDED' }), 'login')).toBe(
      'This account has been suspended.',
    );
    expect(authErrorMessage(failure({ status: 403, code: 'ACCOUNT_SUSPENDED' }), 'register')).toBe(
      'This account has been suspended.',
    );
  });

  it('maps pending-verification codes', () => {
    expect(authErrorMessage(failure({ status: 403, code: 'ACCOUNT_PENDING' }), 'login')).toBe(
      'Your account is awaiting verification.',
    );
    expect(authErrorMessage(failure({ status: 403, code: 'VERIFICATION_PENDING' }), 'login')).toBe(
      'Your account is awaiting verification.',
    );
  });

  it('maps registration-specific codes', () => {
    expect(authErrorMessage(failure({ status: 403, code: 'EMAIL_RESERVED' }), 'register')).toBe(
      'This email is reserved for administrators.',
    );
    expect(authErrorMessage(failure({ status: 409, code: 'EMAIL_TAKEN' }), 'register')).toBe(
      'An account with this email already exists.',
    );
    expect(authErrorMessage(failure({ status: 409, code: 'LICENSE_TAKEN' }), 'register')).toBe(
      'That license number is already registered by another doctor.',
    );
  });

  it('falls back to the server message for other 4xx errors', () => {
    expect(
      authErrorMessage(failure({ status: 400, code: 'VALIDATION_ERROR', message: 'Email is required.' }), 'register'),
    ).toBe('Email is required.');
  });

  it('uses the registration fallback when nothing specific applies', () => {
    expect(authErrorMessage(failure({ status: 500 }), 'register')).toBe(
      'Unable to create your account. Please try again.',
    );
  });

  it('uses the connection message as the login fallback', () => {
    expect(authErrorMessage(failure({ status: 500 }), 'login')).toBe(
      "We're having trouble connecting right now. Please try again.",
    );
  });
});