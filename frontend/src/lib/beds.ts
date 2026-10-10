export const WARD_TYPES = [
  'GENERAL',
  'ICU',
  'PEDIATRIC',
  'MATERNITY',
  'EMERGENCY',
  'SURGICAL',
  'ISOLATION',
  'OTHER',
] as const;

export type WardType = (typeof WARD_TYPES)[number];

const WARD_LABELS: Record<WardType, string> = {
  GENERAL: 'General ward',
  ICU: 'Intensive care',
  PEDIATRIC: 'Pediatrics',
  MATERNITY: 'Maternity',
  EMERGENCY: 'Emergency',
  SURGICAL: 'Surgical',
  ISOLATION: 'Isolation',
  OTHER: 'Other',
};

export function wardLabel(ward: string): string {
  return WARD_LABELS[ward as WardType] ?? ward;
}

export type WardRow = {
  ward: string;
  label: string | null;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  updatedAt: string;
};

export type BedSummary = {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
};

export type BedAvailability = {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
};

export function occupancyTone(availableBeds: number, totalBeds: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (totalBeds <= 0) return 'neutral';
  const ratio = availableBeds / totalBeds;
  if (ratio <= 0.05) return 'danger';
  if (ratio <= 0.2) return 'warning';
  return 'success';
}
