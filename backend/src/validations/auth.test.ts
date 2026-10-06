import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.js';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({ name: 'Asha', email: 'A@Test.com', password: 'password123', role: 'PATIENT' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('a@test.com');
  });

  it('rejects a short password', () => {
    expect(registerSchema.safeParse({ name: 'Asha', email: 'a@test.com', password: 'short' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires email and password', () => {
    expect(loginSchema.safeParse({ email: 'a@test.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });
});
