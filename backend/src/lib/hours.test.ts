import { describe, expect, it } from 'vitest';
import { isOpenNow, nowIST, parseHours } from './hours.js';

const at = (day: number, h: number, m = 0) => ({ day, minutes: h * 60 + m });

describe('parseHours', () => {
  it('parses 24-hour facilities', () => {
    expect(parseHours('Open 24 hours')).toEqual({ always: true });
  });

  it('parses day ranges with en-dash', () => {
    const s = parseHours('Mon–Sat 08:00–20:00');
    expect(s).toEqual({ always: false, days: [1, 2, 3, 4, 5, 6], openMin: 480, closeMin: 1200 });
  });

  it('parses full-week ranges', () => {
    const s = parseHours('Mon–Sun 09:00–21:00');
    expect(s && s.always === false && s.days.length).toBe(7);
  });

  it('parses Tue–Sun wrapping', () => {
    const s = parseHours('Tue–Sun 09:00–16:00');
    expect(s && s.always === false && s.days).toEqual([2, 3, 4, 5, 6, 0]);
  });

  it('returns null for junk or missing values', () => {
    expect(parseHours(null)).toBeNull();
    expect(parseHours('')).toBeNull();
    expect(parseHours('call ahead')).toBeNull();
  });
});

describe('isOpenNow', () => {
  it('is open inside hours on a listed day', () => {
    expect(isOpenNow('Mon–Sat 08:00–20:00', at(1, 10))).toBe(true);
    expect(isOpenNow('Mon–Sat 08:00–20:00', at(1, 7, 59))).toBe(false);
    expect(isOpenNow('Mon–Sat 08:00–20:00', at(1, 20))).toBe(false);
  });

  it('is closed on unlisted days', () => {
    expect(isOpenNow('Mon–Fri 09:00–17:00', at(0, 12))).toBe(false);
    expect(isOpenNow('Mon–Fri 09:00–17:00', at(5, 12))).toBe(true);
  });

  it('24-hour facilities are always open', () => {
    expect(isOpenNow('Open 24 hours', at(3, 3))).toBe(true);
  });

  it('unknown hours return null', () => {
    expect(isOpenNow(null, at(1, 12))).toBeNull();
    expect(isOpenNow('weird', at(1, 12))).toBeNull();
  });

  it('handles overnight windows', () => {
    expect(isOpenNow('Mon–Sun 22:00–06:00', at(1, 23))).toBe(true);
    expect(isOpenNow('Mon–Sun 22:00–06:00', at(1, 7))).toBe(false);
    expect(isOpenNow('Mon–Sun 22:00–06:00', at(1, 5))).toBe(true);
  });
});

describe('nowIST', () => {
  it('returns IST day/minutes for a known instant', () => {
    const n = nowIST(new Date('2026-10-07T12:00:00Z')); // 17:30 IST, Wednesday
    expect(n.day).toBe(3);
    expect(n.minutes).toBe(17 * 60 + 30);
  });
});
