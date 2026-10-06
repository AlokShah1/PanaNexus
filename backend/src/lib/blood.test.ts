import { describe, expect, it } from 'vitest';
import { canDonateTo, compatibleDonorGroups, matchScore } from './blood.js';

describe('blood compatibility', () => {
  it('AB+ accepts every group', () => {
    expect(compatibleDonorGroups('AB+')).toHaveLength(8);
  });

  it('O+ cannot donate to A-', () => {
    expect(canDonateTo('O+', 'A-')).toBe(false);
  });

  it('O- donates to everyone', () => {
    expect(canDonateTo('O-', 'AB+')).toBe(true);
    expect(canDonateTo('O-', 'O+')).toBe(true);
  });

  it('scores exact match above compatible', () => {
    expect(matchScore('A+', 'A+')).toBe(2);
    expect(matchScore('O-', 'A+')).toBe(1);
    expect(matchScore('B+', 'A+')).toBe(0);
  });
});
