export const ROLE_VALUES = [
  'PATIENT',
  'DOCTOR',
  'FACILITY_STAFF',
  'AMBULANCE_OPERATOR',
  'BLOOD_DONOR',
  'ORGAN_DONOR',
  'ADMIN',
] as const;

export type Role = (typeof ROLE_VALUES)[number];
