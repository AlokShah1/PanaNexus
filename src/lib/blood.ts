const COMPATIBLE: Record<string, string[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function compatibleDonorGroups(recipientGroup: string): string[] {
  return COMPATIBLE[recipientGroup] ?? [];
}

export function canDonateTo(donorGroup: string, recipientGroup: string): boolean {
  return compatibleDonorGroups(recipientGroup).includes(donorGroup);
}

// Exact match scores higher than a compatible substitution.
export function matchScore(donorGroup: string, recipientGroup: string): number {
  if (donorGroup === recipientGroup) return 2;
  if (canDonateTo(donorGroup, recipientGroup)) return 1;
  return 0;
}
