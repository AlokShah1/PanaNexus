import { describe, expect, it } from 'vitest';
import { humanizeKey, normalizePayload, payloadEntries } from './format';

describe('humanizeKey', () => {
  it('splits camelCase keys into readable labels', () => {
    expect(humanizeKey('licenseNumber')).toBe('License number');
    expect(humanizeKey('facilityAddress')).toBe('Facility address');
    expect(humanizeKey('operatingHours')).toBe('Operating hours');
  });

  it('handles snake_case and kebab-case keys', () => {
    expect(humanizeKey('facility_type')).toBe('Facility type');
    expect(humanizeKey('facility-name')).toBe('Facility name');
  });

  it('capitalizes single words', () => {
    expect(humanizeKey('bio')).toBe('Bio');
    expect(humanizeKey('specialization')).toBe('Specialization');
  });

  it('returns the key unchanged when nothing is left to humanize', () => {
    expect(humanizeKey('')).toBe('');
  });
});

describe('payloadEntries', () => {
  it('humanizes keys and drops empty values', () => {
    expect(
      payloadEntries({ specialization: 'Cardiology', bio: '', licenseNumber: null, phone: '   ' }),
    ).toEqual([['Specialization', 'Cardiology']]);
  });

  it('trims values', () => {
    expect(payloadEntries({ facilityName: '  City Care Hospital  ' })).toEqual([
      ['Facility name', 'City Care Hospital'],
    ]);
  });

  it('returns an empty list for a null payload', () => {
    expect(payloadEntries(null)).toEqual([]);
  });
});

describe('normalizePayload', () => {
  it('passes through plain objects', () => {
    expect(normalizePayload({ bio: 'Hi' })).toEqual({ bio: 'Hi' });
  });

  it('rejects arrays, primitives and null', () => {
    expect(normalizePayload(['a'])).toBeNull();
    expect(normalizePayload('nope')).toBeNull();
    expect(normalizePayload(null)).toBeNull();
  });
});
