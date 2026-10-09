import { describe, expect, it } from 'vitest';
import { buildLocalDownloadToken, verifyLocalDownloadToken } from './storage.js';

const KEY = 'reports/patient-1/abc.pdf';
const NAME = 'report.pdf';

describe('local download tokens', () => {
  it('accepts a freshly signed token', () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = buildLocalDownloadToken('reports/p/r.pdf', exp, 'r.pdf');
    expect(verifyLocalDownloadToken(token, Math.floor(Date.now() / 1000))).toBe('ok');
  });

  it('rejects an expired token even when otherwise valid', () => {
    const token = buildLocalDownloadToken('reports/p/r.pdf', 1_000, 'r.pdf');
    expect(verifyLocalDownloadToken(token, 2_000)).toBe('expired');
  });

  it('rejects a tampered signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = buildLocalDownloadToken('reports/a.pdf', exp, 'a.pdf');
    const forged = { ...token, key: 'reports/other-patient/secret.pdf' };
    expect(verifyLocalDownloadToken(forged)).toBe('invalid');
  });

  it('rejects a token with a non-numeric expiry', () => {
    const token = buildLocalDownloadToken('reports/a.pdf', 123, 'a.pdf');
    expect(verifyLocalDownloadToken({ ...token, exp: Number.NaN })).toBe('invalid');
  });
});
