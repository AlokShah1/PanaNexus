import { beforeAll, describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from './auth-core';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-key-that-is-long-enough';
});

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.startsWith('scrypt:')).toBe(true);
    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});

describe('session tokens', () => {
  it('verifies a freshly created token', () => {
    const token = createSessionToken('user-1', 'PATIENT');
    const payload = verifySessionToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.role).toBe('PATIENT');
  });

  it('rejects a tampered token', () => {
    const token = createSessionToken('user-1', 'ADMIN');
    const [body] = token.split('.');
    expect(verifySessionToken(`${body}.invalidsignature`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const past = Date.now() - 1000 * 60 * 60 * 24 * 8;
    const token = createSessionToken('user-1', 'PATIENT', past);
    expect(verifySessionToken(token)).toBeNull();
  });
});
