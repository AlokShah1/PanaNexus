import { describe, expect, it } from 'vitest';
import { isProRole, needsVerification } from './session';
import type { SessionProfile } from './session';

const profile = (role: string, verificationStatus: SessionProfile['verificationStatus']): SessionProfile => ({
  id: 'u1',
  name: 'Test User',
  email: 't@example.com',
  role,
  verificationStatus,
  phone: null,
  facilityId: null,
  createdAt: '',
});

describe('isProRole', () => {
  it('returns true for professional roles', () => {
    expect(isProRole('DOCTOR')).toBe(true);
    expect(isProRole('FACILITY_STAFF')).toBe(true);
    expect(isProRole('AMBULANCE_OPERATOR')).toBe(true);
  });

  it('returns false for patient, admin, and missing values', () => {
    expect(isProRole('PATIENT')).toBe(false);
    expect(isProRole('ADMIN')).toBe(false);
    expect(isProRole(null)).toBe(false);
    expect(isProRole(undefined)).toBe(false);
  });
});

describe('needsVerification', () => {
  it('requires action while a professional is pending', () => {
    expect(needsVerification(profile('DOCTOR', 'PENDING'))).toBe(true);
  });

  it('requires action when a professional was rejected', () => {
    expect(needsVerification(profile('AMBULANCE_OPERATOR', 'REJECTED'))).toBe(true);
  });

  it('does not require action once verified', () => {
    expect(needsVerification(profile('DOCTOR', 'VERIFIED'))).toBe(false);
  });

  it('does not require action for non-professionals', () => {
    expect(needsVerification(profile('PATIENT', 'VERIFIED'))).toBe(false);
    expect(needsVerification(profile('PATIENT', 'PENDING'))).toBe(false);
  });

  it('is safe for a missing profile', () => {
    expect(needsVerification(null)).toBe(false);
  });
});