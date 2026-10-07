export type AmbulanceRow = {
  id: string;
  registrationNumber: string;
  type: string;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  online: boolean;
};

export const AMBULANCE_TYPES = ['BASIC', 'ADVANCED', 'ICU'] as const;

export const TRIP_STATUSES = new Set(['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING']);