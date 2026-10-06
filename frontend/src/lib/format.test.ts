import { describe, expect, it } from 'vitest';
import { roleLabel } from './format';

describe('roleLabel', () => {
  it('replaces underscores with spaces', () => {
    expect(roleLabel('FACILITY_STAFF')).toBe('FACILITY STAFF');
  });
});
