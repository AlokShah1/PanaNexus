import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from './auth-core.js';

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.startsWith('scrypt:')).toBe(true);
    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('rejects a malformed stored hash', async () => {
    await expect(verifyPassword('anything', 'not-a-real-hash')).resolves.toBe(false);
  });
});

describe('session tokens', () => {
  it('generates unique, high-entropy tokens', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toMatch(/[+/=]/);
  });

  it('hashes tokens deterministically and irreversibly', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toBe(hashSessionToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});
