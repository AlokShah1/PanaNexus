export const ROLES = [
  'PATIENT',
  'DOCTOR',
  'FACILITY_STAFF',
  'AMBULANCE_OPERATOR',
  'BLOOD_DONOR',
  'ORGAN_DONOR',
  'ADMIN',
] as const;

export type RoleName = (typeof ROLES)[number];
