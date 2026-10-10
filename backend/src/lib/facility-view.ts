export type BedRow = {
  facilityId: string;
  ward: string;
  label: string | null;
  totalBeds: number;
  occupiedBeds: number;
  updatedAt: string;
};

export interface BedSummary {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  wards: number;
}

export function computeRating(feedbacks: Array<{ rating: number; status: string }> | undefined | null): {
  avg: number | null;
  count: number;
} {
  if (!feedbacks || feedbacks.length === 0) return { avg: null, count: 0 };
  const approved = feedbacks.filter((f) => f.status === 'APPROVED');
  if (approved.length === 0) return { avg: null, count: 0 };
  const sum = approved.reduce((s, f) => s + (f.rating || 0), 0);
  return { avg: Math.round((sum / approved.length) * 10) / 10, count: approved.length };
}

export function viewBed(b: {
  ward: string;
  label: string | null;
  totalBeds: number;
  occupiedBeds: number;
  updatedAt: string;
}) {
  return {
    ward: b.ward,
    label: b.label,
    totalBeds: b.totalBeds,
    occupiedBeds: b.occupiedBeds,
    availableBeds: Math.max(0, b.totalBeds - b.occupiedBeds),
    updatedAt: b.updatedAt,
  };
}

export function summarizeBeds(rows: BedRow[]): BedSummary {
  const totalBeds = rows.reduce((n, r) => n + r.totalBeds, 0);
  const occupiedBeds = rows.reduce((n, r) => n + r.occupiedBeds, 0);
  return { totalBeds, occupiedBeds, availableBeds: Math.max(0, totalBeds - occupiedBeds), wards: rows.length };
}
