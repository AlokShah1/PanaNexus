import { describe, expect, it } from 'vitest';
import { slotTaken } from './appointments.js';
import { createAppointmentSchema, facilitySchema, medicalRecordSchema, bedCapacitySchema } from '../validations/healthcare.js';

describe('slotTaken', () => {
  it('detects a direct conflict with the same instant', () => {
    const existing = [{ startsAt: '2026-10-06T10:00:00.000Z', status: 'CONFIRMED' }];
    expect(slotTaken(existing, '2026-10-06T10:00:00.000Z')).toBe(true);
  });

  it('ignores cancelled slots', () => {
    const existing = [{ startsAt: '2026-10-06T10:00:00.000Z', status: 'CANCELLED' }];
    expect(slotTaken(existing, '2026-10-06T10:00:00.000Z')).toBe(false);
  });

  it('normalizes offset timestamps', () => {
    const existing = [{ startsAt: '2026-10-06T10:00:00.000Z', status: 'CONFIRMED' }];
    expect(slotTaken(existing, '2026-10-06T15:45:00.000+05:45')).toBe(true);
  });
});

describe('validation schemas', () => {
  it('accepts a valid appointment', () => {
    expect(
      createAppointmentSchema.safeParse({ doctorId: 'd1', startsAt: '2026-10-06T10:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('rejects an invalid facility type', () => {
    expect(
      facilitySchema.safeParse({ name: 'Bir Hospital', type: 'CLINIC', address: 'Kathmandu' }).success,
    ).toBe(false);
  });

  it('requires patientId for medical records', () => {
    expect(medicalRecordSchema.safeParse({ diagnosis: 'x' }).success).toBe(false);
  });

  it('accepts a valid bed capacity entry', () => {
    expect(bedCapacitySchema.safeParse({ ward: 'ICU', totalBeds: 12, occupiedBeds: 5 }).success).toBe(true);
  });

  it('defaults occupied beds to zero', () => {
    const parsed = bedCapacitySchema.safeParse({ ward: 'GENERAL', totalBeds: 10 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.occupiedBeds).toBe(0);
  });

  it('rejects occupied beds greater than total beds', () => {
    expect(bedCapacitySchema.safeParse({ ward: 'ICU', totalBeds: 2, occupiedBeds: 5 }).success).toBe(false);
  });

  it('rejects an unknown ward type', () => {
    expect(bedCapacitySchema.safeParse({ ward: 'ROOFTOP', totalBeds: 1, occupiedBeds: 0 }).success).toBe(false);
  });
});
