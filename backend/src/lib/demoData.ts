import { db } from '../../prisma/db.js';
import { hashPassword } from './auth-core.js';
import { createHash, randomUUID } from 'node:crypto';
import { getStorage } from './storage.js';

/**
 * Synthetic demo data for presentation and testing ONLY.
 * Every account uses the `@pananexus.local` suffix, and every created row id is
 * recorded in the `demo.data.ledger` PlatformSetting so it can be cleared safely
 * without ever touching real data.
 *
 * The dataset is deterministic (seeded RNG), idempotent (re-running refreshes via
 * clear + reseed), and geographically coherent (Bhopal metro area).
 */

export const DEMO_EMAIL_DOMAIN = 'pananexus.local';
export const DEMO_NOTE = 'Demo data is synthetic and for presentation/testing only.';
const LEDGER_KEY = 'demo.data.ledger';

type Ledger = Record<string, string[]>;

function newLedger(): Ledger {
  return {
    users: [],
    patients: [],
    doctors: [],
    availability: [],
    appointments: [],
    records: [],
    reportFiles: [],
    ambulances: [],
    emergencies: [],
    trips: [],
    locations: [],
    notifications: [],
    feedback: [],
    bloodUnits: [],
    bloodRequests: [],
    bloodDonors: [],
    organDonors: [],
    verifications: [],
    facilities: [],
    bedCapacities: [],
    conversations: [],
    messages: [],
  };
}

async function readLedger(): Promise<Ledger> {
  const row = await db.orm.public.PlatformSetting.where({ key: LEDGER_KEY }).first();
  if (!row?.value) return newLedger();
  try {
    return { ...newLedger(), ...(JSON.parse(row.value) as Ledger) };
  } catch {
    return newLedger();
  }
}

async function writeLedger(ledger: Ledger): Promise<void> {
  await db.orm.public.PlatformSetting.upsert({
    create: { key: LEDGER_KEY, value: JSON.stringify(ledger) },
    update: { value: JSON.stringify(ledger) },
  });
}

/* Deterministic RNG so a re-seed produces the same dataset shape. */
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260107);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Sara', 'Ishaan', 'Ananya', 'Vihaan', 'Aditi',
  'Arjun', 'Freya', 'Aditya', 'Saanvi', 'Reyansh', 'Pari', 'Krishna', 'Anika', 'Yash', 'Kiara',
  'Dhruv', 'Riya', 'Manav', 'Tanvi', 'Samarth', 'Navya', 'Shaurya', 'Ira', 'Vedant', 'Rhea',
  'Arnav', 'Myra', 'Dev', 'Sanya', 'Onkar', 'Trisha', 'Sahil', 'Mahi', 'Aryan', 'Zoya',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Iyer', 'Nair', 'Gupta', 'Khan', 'Menon', 'Pillai', 'Rao', 'Kulkarni',
  'Chatterjee', 'Deshmukh', 'Reddy', 'Joshi', 'Bansal', 'Malhotra', 'Sikri', 'Chauhan', 'Thakur',
  'Srivastava', 'Banerjee', 'Das', 'Mukherjee', 'Choudhary', 'Mishra', 'Saxena', 'Patel', 'Shah',
  'Agarwal', 'Saxena',
];
const AREAS = [
  'Arera Colony', 'MP Nagar', 'Kolar Road', 'Shahpura', 'New Market', 'Hoshangabad Road',
  'Govindpura', 'Bairagarh', 'Neelbad', 'Shantipur', 'Barahmanda', 'Jahangirabad', 'TT Nagar',
  'Lalghati', 'Ashoka Garden', 'Kolar', 'Bawadiya', 'Nowgong',
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const FACILITIES = [
  { name: 'City General Hospital', type: 'HOSPITAL' as const, lat: 23.2333, lng: 77.401, address: '12 Mahatma Gandhi Road, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Emergency', 'ICU', 'Cardiology', 'Orthopaedics', 'Diagnostics'] },
  { name: 'Green Cross Hospital', type: 'HOSPITAL' as const, lat: 23.19, lng: 77.42, address: 'Green Cross Road, Shahpura, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Emergency', 'General Medicine', 'Surgery', 'Diagnostics'] },
  { name: 'Lakeview Children Hospital', type: 'HOSPITAL' as const, lat: 23.258, lng: 77.39, address: 'Lakeview Avenue, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Paediatrics', 'Neonatal', 'Emergency'] },
  { name: 'Sunrise Multispeciality', type: 'HOSPITAL' as const, lat: 23.208, lng: 77.411, address: 'Sunrise Road, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Emergency', 'Cardiology', 'Neurology', 'ICU'] },
  { name: 'Barahmanda Health Post', type: 'HEALTH_POST' as const, lat: 23.16, lng: 77.39, address: 'Barahmanda, Bhopal', emergency: false, hours: '08:00 - 20:00', services: ['OPD', 'Immunisation', 'Maternity'] },
  { name: 'Govindpura Health Post', type: 'HEALTH_POST' as const, lat: 23.245, lng: 77.44, address: 'Govindpura industrial area, Bhopal', emergency: false, hours: 'Mon–Sat 08:30–16:30', services: ['OPD', 'Maternity', 'Immunization', 'Pathology'] },
  { name: 'Neelbad Community Health Post', type: 'HEALTH_POST' as const, lat: 23.29, lng: 77.35, address: 'Neelbad village road, Bhopal', emergency: false, hours: 'Mon–Fri 09:00–15:00', services: ['OPD', 'First aid', 'Elementary care'] },
  { name: 'Shantipur Health Post', type: 'HEALTH_POST' as const, lat: 23.27, lng: 77.31, address: 'Shantipur, Kolar, Bhopal', emergency: false, hours: 'Mon–Fri 09:00–17:00', services: ['OPD', 'First aid', 'Immunization'] },
  { name: 'Old City Clinic', type: 'HEALTH_POST' as const, lat: 23.262, lng: 77.397, address: 'Old City, Bhopal', emergency: false, hours: '08:00 - 14:00', services: ['OPD', 'General Medicine'] },
  { name: 'Kolar Road Clinic', type: 'HEALTH_POST' as const, lat: 23.235, lng: 77.365, address: 'Kolar Road, Bhopal', emergency: false, hours: '09:00 - 18:00', services: ['OPD', 'Diagnostics', 'Vaccination'] },
];

async function ensureFacility(f: (typeof FACILITIES)[number]) {
  const existing = await db.orm.public.HealthcareFacility.where({ name: f.name, address: f.address }).first();
  if (existing) return existing;
  const row = await db.orm.public.HealthcareFacility.create({
    name: f.name,
    type: f.type,
    address: f.address,
    latitude: f.lat,
    longitude: f.lng,
    emergencyAvailable: f.emergency,
    operatingHours: f.hours,
    services: f.services,
  });
  return row;
}

async function ensureUser(
  ledger: Ledger,
  passwordHash: string,
  data: { email: string; name: string; role: 'PATIENT' | 'DOCTOR' | 'FACILITY_STAFF' | 'AMBULANCE_OPERATOR' | 'BLOOD_DONOR' | 'ORGAN_DONOR' | 'ADMIN'; phone?: string; facilityId?: string | null; verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' },
) {
  const existing = await db.orm.public.User.where({ email: data.email }).first();
  if (existing) return existing;
  const created = await db.orm.public.User.create({
    email: data.email,
    name: data.name,
    role: data.role,
    phone: data.phone ?? null,
    facilityId: data.facilityId ?? null,
    verificationStatus: data.verificationStatus ?? 'VERIFIED',
    passwordHash,
  });
  ledger.users.push(created.id);
  return created;
}

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Paediatrics', 'Orthopedics', 'Gynaecology', 'Dermatology',
  'Neurology', 'ENT', 'Pulmonology', 'Psychiatry', 'General Surgery', 'Ophthalmology', 'Dentistry',
  'Radiology', 'Oncology', 'Urology', 'Anaesthesiology',
] as const;

export async function seedDemoData() {
  await clearDemoData();
  const ledger = newLedger();
  const password = process.env.DEMO_PASSWORD ?? process.env.SEED_PASSWORD ?? 'TestPass!123';
  const passwordHash = await hashPassword(password);

  const facilities: { id: string; name: string }[] = [];
  for (const f of FACILITIES) {
    const row = await ensureFacility(f);
    facilities.push(row);
  }

  /* --------------------------------------------------------- bed capacity */
  const HOSPITAL_BEDS = [
    { ward: 'GENERAL', total: 72, occupied: 54 },
    { ward: 'ICU', total: 14, occupied: 10 },
    { ward: 'EMERGENCY', total: 10, occupied: 6 },
    { ward: 'PEDIATRIC', total: 22, occupied: 13 },
    { ward: 'MATERNITY', total: 18, occupied: 11 },
    { ward: 'SURGICAL', total: 16, occupied: 7 },
    { ward: 'ISOLATION', total: 6, occupied: 2 },
  ] as const;
  const HEALTH_POST_BEDS = [
    { ward: 'GENERAL', total: 6, occupied: 2 },
    { ward: 'MATERNITY', total: 4, occupied: 1 },
  ] as const;
  for (let i = 0; i < facilities.length; i += 1) {
    const wards = FACILITIES[i].type === 'HOSPITAL' ? HOSPITAL_BEDS : HEALTH_POST_BEDS;
    for (const w of wards) {
      const existing = await db.orm.public.BedCapacity.where({
        facilityId: facilities[i].id,
        ward: w.ward as never,
      }).first();
      if (existing) continue;
      const occupied = Math.max(0, Math.min(w.total, w.occupied + (i % 3) - 1));
      const row = await db.orm.public.BedCapacity.create({
        facilityId: facilities[i].id,
        ward: w.ward as never,
        totalBeds: w.total,
        occupiedBeds: occupied,
      });
      ledger.bedCapacities.push(row.id);
    }
  }

  /* ------------------------------------------------------------- patients */
  const patientUsers: { id: string; patientId: string; name: string }[] = [];
  const patientNames: string[] = [];
  for (let i = 0; i < 75; i += 1) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`;
    patientNames.push(name);
    const u = await ensureUser(ledger, passwordHash, {
      email: `patient.${i + 1}@${DEMO_EMAIL_DOMAIN}`,
      name,
      role: 'PATIENT',
      phone: `98${String(10000000 + i * 137).slice(0, 8)}`,
      verificationStatus: 'VERIFIED',
    });
    let patient = await db.orm.public.Patient.where({ userId: u.id }).first();
    if (!patient) {
      const dobYear = 1958 + ((i * 13) % 50);
      patient = await db.orm.public.Patient.create({
        userId: u.id,
        bloodGroup: BLOOD_GROUPS[i % BLOOD_GROUPS.length],
        dateOfBirth: new Date(Date.UTC(dobYear, (i * 5) % 12, ((i * 7) % 27) + 1)).toISOString(),
        phone: u.phone,
        address: `${((i * 3) % 120) + 1}, ${AREAS[i % AREAS.length]}, Bhopal`,
      });
      ledger.patients.push(patient.id);
    }
    patientUsers.push({ id: u.id, patientId: patient.id, name });
  }

  /* -------------------------------------------------------------- doctors */
  const doctorUsers: { id: string; doctorId: string }[] = [];
  for (let i = 0; i < 28; i += 1) {
    const name = `Dr. ${FIRST_NAMES[(i + 11) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3 + 5) % LAST_NAMES.length]}`;
    const u = await ensureUser(ledger, passwordHash, {
      email: `doctor.${i + 1}@${DEMO_EMAIL_DOMAIN}`,
      name,
      role: 'DOCTOR',
      phone: `98${String(20000000 + i * 271).slice(0, 8)}`,
      facilityId: facilities[i % facilities.length].id,
      verificationStatus: 'VERIFIED',
    });
    let doctor = await db.orm.public.Doctor.where({ userId: u.id }).first();
    if (!doctor) {
      doctor = await db.orm.public.Doctor.create({
        userId: u.id,
        facilityId: facilities[i % facilities.length].id,
        specialization: SPECIALTIES[i % SPECIALTIES.length],
        licenseNumber: `DEMO-DOC-2026-${String(i + 1).padStart(3, '0')}`,
        bio: `${SPECIALTIES[i % SPECIALTIES.length]} consultant with regular OPD hours.`,
      });
      ledger.doctors.push(doctor.id);
      for (const weekday of [1, 3, 5]) {
        const slot = await db.orm.public.DoctorAvailability.create({
          doctorId: doctor.id,
          weekday,
          startMinute: 9 * 60,
          endMinute: 13 * 60,
          slotMinutes: 30,
        });
        ledger.availability.push(slot.id);
      }
    }
    doctorUsers.push({ id: u.id, doctorId: doctor.id });
  }

  /* -------------------------------------------------------- facility staff */
  for (let i = 0; i < 12; i += 1) {
    await ensureUser(ledger, passwordHash, {
      email: `staff.${i + 1}@${DEMO_EMAIL_DOMAIN}`,
      name: `${FIRST_NAMES[(i + 20) % FIRST_NAMES.length]} ${LAST_NAMES[(i + 9) % LAST_NAMES.length]}`,
      role: 'FACILITY_STAFF',
      facilityId: facilities[i % facilities.length].id,
      phone: `98${String(30000000 + i * 313).slice(0, 8)}`,
      verificationStatus: i % 5 === 0 ? 'PENDING' : 'VERIFIED',
    });
  }

  /* ----------------------------------------------------------- ambulances */
  const operatorUsers: { id: string; ambulanceId: string }[] = [];
  for (let i = 0; i < 12; i += 1) {
    const reg = `MP04-AM-${1001 + i}`;
    const u = await ensureUser(ledger, passwordHash, {
      email: `operator.${i + 1}@${DEMO_EMAIL_DOMAIN}`,
      name: `${FIRST_NAMES[(i + 25) % FIRST_NAMES.length]} ${LAST_NAMES[(i + 14) % LAST_NAMES.length]}`,
      role: 'AMBULANCE_OPERATOR',
      phone: `98${String(40000000 + i * 419).slice(0, 8)}`,
      verificationStatus: 'VERIFIED',
    });
    let amb = await db.orm.public.Ambulance.where({ registrationNumber: reg }).first();
    if (!amb) {
      const status = i === 0 ? 'EN_ROUTE' : i % 7 === 0 ? 'OFFLINE' : i % 5 === 0 ? 'ASSIGNED' : 'AVAILABLE';
      amb = await db.orm.public.Ambulance.create({
        registrationNumber: reg,
        type: (['BASIC', 'ADVANCED', 'ICU'] as const)[i % 3],
        status: status as never,
        operatorId: u.id,
        latitude: 23.23 + ((i * 3) % 11) * 0.004,
        longitude: 77.40 + ((i * 5) % 11) * 0.004,
        driverName: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
        driverPhone: `98${String(50000000 + i * 431).slice(0, 8)}`,
      });
      ledger.ambulances.push(amb.id);
    }
    operatorUsers.push({ id: u.id, ambulanceId: amb.id });
  }

  /* ---------------------------------------------------------- demo logins */
  const accents: Array<[string, string, 'PATIENT' | 'DOCTOR' | 'FACILITY_STAFF' | 'AMBULANCE_OPERATOR', string]> = [
    ['patient.demo@' + DEMO_EMAIL_DOMAIN, 'Priya Nair', 'PATIENT', 'Patient demo'],
    ['doctor.demo@' + DEMO_EMAIL_DOMAIN, 'Dr. Meera Iyer', 'DOCTOR', 'Doctor demo'],
    ['facility.demo@' + DEMO_EMAIL_DOMAIN, 'Rakesh Kapoor', 'FACILITY_STAFF', 'Facility demo'],
    ['ambulance.demo@' + DEMO_EMAIL_DOMAIN, 'Imran Sheikh', 'AMBULANCE_OPERATOR', 'Ambulance demo'],
  ];
  for (const [email, name, role, _] of accents) {
    await ensureUser(ledger, passwordHash, {
      email,
      name,
      role,
      phone: '9800000000',
      facilityId: facilities[0].id,
      verificationStatus: 'VERIFIED',
    });
  }

  // Patient demo account — browsable history in the patient UI
  {
    const u = await db.orm.public.User.where({ email: `patient.demo@${DEMO_EMAIL_DOMAIN}` }).first();
    let pat = u && (await db.orm.public.Patient.where({ userId: u.id }).first());
    if (u && !pat) {
      pat = await db.orm.public.Patient.create({
        userId: u.id,
        bloodGroup: 'O+',
        dateOfBirth: new Date(Date.UTC(1990, 3, 15)).toISOString(),
        phone: u.phone,
        address: 'Arera Colony, Bhopal',
      });
      ledger.patients.push(pat.id);
      const doc = doctorUsers[0];
      const rec1 = await db.orm.public.MedicalRecord.create({
        patientId: pat.id, doctorId: doc.doctorId, facilityId: facilities[0].id,
        recordType: 'CONSULTATION', diagnosis: 'Type 2 diabetes mellitus',
        treatment: 'Lifestyle modification and oral agent',
        prescriptions: ['Metformin 500 mg — twice daily after meals for 90 days'],
        attachments: [], notes: DEMO_NOTE,
        createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
      });
      ledger.records.push(rec1.id);
      const rec2 = await db.orm.public.MedicalRecord.create({
        patientId: pat.id, doctorId: doc.doctorId, facilityId: facilities[0].id,
        recordType: 'CONSULTATION', diagnosis: 'Essential hypertension',
        treatment: 'Lifestyle and medical therapy',
        prescriptions: ['Amlodipine 5 mg — once daily for 30 days'],
        attachments: [], notes: 'Follow-up in 30 days',
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      });
      ledger.records.push(rec2.id);
      const appt = await db.orm.public.Appointment.create({
        patientId: pat.id, doctorId: doc.doctorId, facilityId: facilities[0].id,
        startsAt: new Date(Date.now() + 2 * 86400000).toISOString(), status: 'CONFIRMED', notes: 'Routine diabetes follow-up',
      });
      ledger.appointments.push(appt.id);
    }
  }

  // Doctor demo account — has a doctor profile + availability
  {
    const u = await db.orm.public.User.where({ email: `doctor.demo@${DEMO_EMAIL_DOMAIN}` }).first();
    let doc = u && (await db.orm.public.Doctor.where({ userId: u.id }).first());
    if (u && !doc) {
      doc = await db.orm.public.Doctor.create({
        userId: u.id, facilityId: facilities[0].id, specialization: 'General Medicine',
        licenseNumber: 'DEMO-DOC-2026-900', bio: 'General Medicine consultant (demo account).',
      });
      ledger.doctors.push(doc.id);
      for (const weekday of [1, 3, 5]) {
        const slot = await db.orm.public.DoctorAvailability.create({
          doctorId: doc.id, weekday, startMinute: 9 * 60, endMinute: 13 * 60, slotMinutes: 30,
        });
        ledger.availability.push(slot.id);
      }
    }
  }

  // Ambulance demo account — an available unit in the fleet
  {
    const u = await db.orm.public.User.where({ email: `ambulance.demo@${DEMO_EMAIL_DOMAIN}` }).first();
    let amb = u && (await db.orm.public.Ambulance.where({ operatorId: u.id }).first());
    if (u && !amb) {
      amb = await db.orm.public.Ambulance.create({
        registrationNumber: 'MP04-AM-9999', type: 'ADVANCED', status: 'AVAILABLE', operatorId: u.id,
        latitude: 23.25, longitude: 77.41, driverName: 'Demo Driver', driverPhone: '9800000000',
      });
      ledger.ambulances.push(amb.id);
    }
  }

  /* ------------------------------------------------------ blood donors */
  for (let i = 0; i < 50; i += 1) {
    const u = patientUsers[i];
    let donor = await db.orm.public.BloodDonor.where({ userId: u.id }).first();
    if (!donor) {
      donor = await db.orm.public.BloodDonor.create({
        userId: u.id,
        bloodGroup: BLOOD_GROUPS[i % BLOOD_GROUPS.length],
        isAvailable: i % 6 !== 0,
        lastDonationDate: new Date(Date.now() - (i * 11) * 24 * 60 * 60 * 1000).toISOString(),
      });
      ledger.bloodDonors.push(donor.id);
    }
  }

  /* ------------------------------------------------------ organ donors */
  const ORGANS = ['kidney', 'liver', 'heart', 'lungs', 'pancreas', 'cornea'] as const;
  for (let i = 0; i < 25; i += 1) {
    const u = patientUsers[i + 50];
    let organ = await db.orm.public.OrganDonor.where({ userId: u.id }).first();
    if (!organ) {
      organ = await db.orm.public.OrganDonor.create({
        userId: u.id,
        organs: [ORGANS[i % ORGANS.length], ORGANS[(i + 2) % ORGANS.length]],
        consent: true,
        status: i % 5 === 0 ? 'VERIFIED' : i % 7 === 0 ? 'INACTIVE' : 'PLEDGED',
      });
      ledger.organDonors.push(organ.id);
    }
  }

  /* ----------------------------------------------------------- blood stock */
  for (const f of facilities) {
    for (let g = 0; g < BLOOD_GROUPS.length; g += 1) {
      const existing = await db.orm.public.BloodUnit.where({ facilityId: f.id, bloodGroup: BLOOD_GROUPS[g] as never }).first();
      if (!existing) {
        const unit = await db.orm.public.BloodUnit.create({
          facilityId: f.id,
          bloodGroup: BLOOD_GROUPS[g] as never,
          units: [14, 6, 11, 5, 9, 3, 4, 2][g],
        });
        ledger.bloodUnits.push(unit.id);
      }
    }
  }

  /* ------------------------------------------------------- blood requests */
  for (let i = 0; i < 15; i += 1) {
    const requester = patientUsers[i];
    const row = await db.orm.public.BloodRequest.create({
      requesterId: requester.id,
      facilityId: facilities[i % facilities.length].id,
      bloodGroup: BLOOD_GROUPS[i % BLOOD_GROUPS.length] as never,
      units: 1 + (i % 3),
      status: (['PENDING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'CANCELLED'] as const)[i % 4] as never,
    });
    ledger.bloodRequests.push(row.id);
  }

  /* ---------------------------------------------------------- appointments */
  const apptDayOffsets = [-6, -4, -2, -1, 0, 2, 5, 9];
  const apptStatusCycle = ['COMPLETED', 'COMPLETED', 'CANCELLED', 'CONFIRMED', 'REQUESTED', 'NO_SHOW', 'REQUESTED', 'COMPLETED'] as const;
  for (let d = 0; d < doctorUsers.length; d += 1) {
    const doctor = doctorUsers[d];
    for (let a = 0; a < apptDayOffsets.length; a += 1) {
      const startsAt = new Date(Date.now() + apptDayOffsets[a] * 86400000 + (9 * 60 + ((d % 4) * 45 + (a % 3) * 15)) * 60000).toISOString();
      const row = await db.orm.public.Appointment.create({
        patientId: patientUsers[(d * 8 + a) % patientUsers.length].patientId,
        doctorId: doctor.doctorId,
        facilityId: facilities[d % facilities.length].id,
        startsAt,
        status: apptStatusCycle[(d + a) % apptStatusCycle.length] as never,
        notes: a % 3 === 0 ? 'Follow-up / review visit' : null,
      });
      ledger.appointments.push(row.id);
    }
  }

  /* -------------------------------------------------------- medical records */
  const recordTemplates = [
    { type: 'CONSULTATION', diagnosis: 'Type 2 diabetes mellitus', treatment: 'Lifestyle modification and oral agent', rx: 'Metformin 500 mg — twice daily after meals for 90 days' },
    { type: 'CONSULTATION', diagnosis: 'Acute bronchitis', treatment: 'Symptomatic management', rx: 'Salbutamol inhaler 2 puffs — as needed; Paracetamol 500 mg — twice daily for 5 days' },
    { type: 'CONSULTATION', diagnosis: 'Ankle sprain', treatment: 'Rest, ice, compression, elevation', rx: 'Diclofenac gel — apply twice daily for 7 days' },
    { type: 'CONSULTATION', diagnosis: 'Viral upper respiratory infection', treatment: 'Supportive care and hydration', rx: 'Paracetamol 500 mg — every 6 hours as needed for 5 days' },
    { type: 'CONSULTATION', diagnosis: 'Essential hypertension', treatment: 'Lifestyle and medical therapy', rx: 'Amlodipine 5 mg — once daily for 30 days' },
    { type: 'LAB_RESULT', diagnosis: 'Lipid profile review', treatment: 'Reduced fried/processed food', rx: 'Atorvastatin 10 mg — once at night for 30 days' },
    { type: 'IMAGING', diagnosis: 'Chest X-ray — no acute infiltrate', treatment: 'Clinical correlation advised', rx: 'No new medication; review in 2 weeks' },
    { type: 'PRESCRIPTION', diagnosis: 'Migraine', treatment: 'Abortive therapy', rx: 'Sumatriptan 50 mg — at onset, repeat after 2 hours if needed' },
    { type: 'VACCINATION', diagnosis: 'Routine immunisation administered', treatment: 'Observed for 15 minutes', rx: 'None — keep routine schedule' },
    { type: 'OTHER', diagnosis: 'Synthetic pregnancy follow-up', treatment: 'Routine antenatal checks', rx: 'Folic acid 5 mg — once daily; Iron supplement — once daily' },
  ] as const;
  for (let i = 0; i < 140; i += 1) {
    const patient = patientUsers[i % patientUsers.length];
    const doctor = doctorUsers[Math.floor(i / 2) % doctorUsers.length];
    const t = recordTemplates[i % recordTemplates.length];
    const createdAt = new Date(Date.now() - ((i * 17) % 330) * 86400000).toISOString();
    const row = await db.orm.public.MedicalRecord.create({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      facilityId: facilities[i % facilities.length].id,
      recordType: t.type as never,
      diagnosis: t.diagnosis,
      treatment: t.treatment,
      prescriptions: [t.rx],
      attachments: [],
      notes: DEMO_NOTE,
      createdAt,
    });
    ledger.records.push(row.id);
  }

  /* ---------------------------------------------------- demo report files */
  // Synthetic PDFs kept under a `demo/` prefix and flagged isDemo so they never
  // mix with real patient documents.
  const demoPdf = Buffer.from(
    '%PDF-1.4\n% PanaNexus synthetic demo report\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    'latin1',
  );
  const reportCategories = ['MEDICAL_REPORT', 'LAB_RESULT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY'] as const;
  for (let i = 0; i < 18; i += 1) {
    const patient = patientUsers[i % patientUsers.length];
    const doctor = doctorUsers[Math.floor(i / 2) % doctorUsers.length];
    const category = reportCategories[i % reportCategories.length];
    const storageKey = `demo/${patient.patientId}/${randomUUID()}.pdf`;
    await getStorage().put(storageKey, demoPdf, 'application/pdf');
    const row = await db.orm.public.ReportFile.create({
      patientId: patient.patientId,
      recordId: null,
      uploadedById: doctor.id,
      category: category as never,
      title: `${category.replace(/_/g, ' ').toLowerCase()} — synthetic demo`,
      originalFilename: `demo-${category.toLowerCase()}-${i + 1}.pdf`,
      storageKey,
      mimeType: 'application/pdf',
      sizeBytes: demoPdf.length,
      checksumSha256: createHash('sha256').update(demoPdf).digest('hex'),
      isDemo: true,
    });
    ledger.reportFiles.push(row.id);
  }

  /* ------------------------------------------------------ emergencies/trips */
  const categories: Array<'MEDICAL' | 'ACCIDENT' | 'INJURY' | 'PREGNANCY' | 'BREATHING'> = ['MEDICAL', 'ACCIDENT', 'INJURY', 'PREGNANCY', 'BREATHING'];
  const makeRequest = async (i: number, status: 'PENDING' | 'MATCHED' | 'ASSIGNED' | 'EN_ROUTE' | 'COMPLETED' | 'CANCELLED', priority: 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    const p = patientUsers[i];
    const row = await db.orm.public.EmergencyRequest.create({
      requesterId: p.id,
      patientId: p.patientId,
      category: categories[i % categories.length],
      priority,
      status,
      pickupLatitude: 23.23 + ((i * 7) % 9) * 0.004,
      pickupLongitude: 77.40 + ((i * 11) % 9) * 0.004,
      pickupAccuracy: 15,
      pickupObtainedAt: new Date(Date.now() - i * 30 * 60000).toISOString(),
      pickupAddress: `${AREAS[i % AREAS.length]}, Bhopal`,
      cancelReason: status === 'CANCELLED' ? 'Resolved before unit arrived' : null,
    });
    ledger.emergencies.push(row.id);
    return row;
  };

  // Live EN_ROUTE trip (simulated demo tracking)
  const live = await makeRequest(0, 'EN_ROUTE', 'HIGH');
  const liveTrip = await db.orm.public.Trip.create({
    emergencyRequestId: live.id, ambulanceId: operatorUsers[0].ambulanceId, status: 'EN_ROUTE', isSimulation: true,
  });
  ledger.trips.push(liveTrip.id);
  await db.orm.public.Ambulance.where({ id: operatorUsers[0].ambulanceId }).update({ status: 'EN_ROUTE' as never });
  for (let i = 1; i <= 4; i += 1) {
    const loc = await db.orm.public.LocationUpdate.create({
      tripId: liveTrip.id,
      latitude: 23.2199 + (23.2299 - 23.2199) * (i / 5),
      longitude: 77.3909 + (77.4099 - 77.3909) * (i / 5),
      accuracy: 12,
    });
    ledger.locations.push(loc.id);
  }

  // Open, searchable request for simulation
  await makeRequest(1, 'PENDING', 'CRITICAL');
  const requested = await makeRequest(2, 'MATCHED', 'HIGH');

  // Completed trips
  for (const [idx, goAgoDays] of [[3, 2], [4, 5], [5, 12], [6, 20]] as const) {
    const req = await makeRequest(idx, 'COMPLETED', idx % 2 === 0 ? 'MEDIUM' : 'HIGH');
    const trip = await db.orm.public.Trip.create({
      emergencyRequestId: req.id, ambulanceId: operatorUsers[(idx + 1) % operatorUsers.length].ambulanceId,
      status: 'COMPLETED',
      arrivedAt: new Date(Date.now() - goAgoDays * 86400000 + 20 * 60000).toISOString(),
      completedAt: new Date(Date.now() - goAgoDays * 86400000 + 45 * 60000).toISOString(),
      endedAt: new Date(Date.now() - goAgoDays * 86400000 + 45 * 60000).toISOString(),
    });
    ledger.trips.push(trip.id);
  }
  await makeRequest(7, 'CANCELLED', 'MEDIUM');

  /* ------------------------------------------------------------- feedback */
  const comments = [
    'Doctor was calm and explained everything clearly.',
    'Waiting room was crowded but the care was good.',
    'Helpful staff and timely pharmacy.',
    'Ambulance arrived promptly; crew was reassuring.',
    'Clean facility and well-organised OPD.',
    'A bit of delay in billing, but consultation was worthwhile.',
    'Friendly front desk and clear instructions.',
    'Quick lab results and kind follow-up advice.',
  ];
  for (let i = 0; i < 40; i += 1) {
    const author = patientUsers[i];
    const row = await db.orm.public.Feedback.create({
      authorId: author.id,
      facilityId: facilities[i % facilities.length].id,
      rating: [5, 4, 4, 3, 5, 2, 4, 5][i % 8],
      comment: comments[i % comments.length],
      status: i % 6 === 0 ? 'PENDING' : 'APPROVED',
    });
    ledger.feedback.push(row.id);
  }

  /* --------------------------------------------------------- notifications */
  const notifTemplates: Array<[string, string, string]> = [
    ['APPOINTMENT', 'Appointment confirmed', 'Your appointment has been confirmed.'],
    ['APPOINTMENT', 'Your appointment starts in 45 minutes', 'Please reach the facility 10 minutes early.'],
    ['VERIFICATION', 'Doctor verification approved', 'Your professional verification was approved.'],
    ['EMERGENCY', 'Ambulance assigned', 'An ambulance is assigned to your request.'],
    ['BLOOD', 'Blood request matched', 'A donor has matched your request.'],
    ['FEEDBACK', 'Your feedback was received', 'Thanks — your feedback helps us improve.'],
  ];
  for (let i = 0; i < 70; i += 1) {
    const [type, title, body] = notifTemplates[i % notifTemplates.length];
    const row = await db.orm.public.Notification.create({
      userId: patientUsers[i % patientUsers.length].id,
      type, title, body,
      read: i % 3 !== 0,
      link: '/dashboard',
      createdAt: new Date(Date.now() - i * 36 * 60000).toISOString(),
    });
    ledger.notifications.push(row.id);
  }

  /* ----------------------------------------------------- verification mix */
  const vstatuses = ['PENDING', 'APPROVED', 'REJECTED', 'PENDING', 'APPROVED', 'PENDING', 'REJECTED', 'APPROVED'] as const;
  const vkinds = ['DOCTOR', 'DOCTOR', 'FACILITY', 'AMBULANCE', 'DOCTOR', 'FACILITY', 'AMBULANCE', 'DOCTOR'] as const;
  for (let i = 0; i < vstatuses.length; i += 1) {
    let userId: string | null = null;
    if (vkinds[i] === 'DOCTOR') userId = doctorUsers[i % doctorUsers.length].id;
    else if (vkinds[i] === 'AMBULANCE') userId = operatorUsers[i % operatorUsers.length].id;
    else userId = (await db.orm.public.User.where({ email: `staff.${(i % 12) + 1}@${DEMO_EMAIL_DOMAIN}` }).first())?.id ?? null;
    if (!userId) continue;
    const row = await db.orm.public.VerificationRequest.create({
      userId,
      kind: vkinds[i],
      status: vstatuses[i],
      payload: JSON.stringify({ demoId: `DEMO-${vkinds[i]}-2026-${String(i + 1).padStart(3, '0')}` }),
      documentUrls: [`/uploads/demo/demo-${vkinds[i].toLowerCase()}-${i + 1}.pdf`],
      reason: vstatuses[i] === 'REJECTED' ? 'Document not legible — please re-upload.' : 'Under review.',
      reviewedAt: ['APPROVED', 'REJECTED'].includes(vstatuses[i]) ? new Date(Date.now() - i * 86400000).toISOString() : null,
    });
    ledger.verifications.push(row.id);
  }

  /* ------------------------------------------------------ secure messages */
  const msgLines = [
    'Hello doctor, I have been feeling better since the new prescription.',
    'Good to hear. Continue the medication and keep monitoring your readings.',
    'Should I book a follow-up this month?',
    'Yes, please book a follow-up in two weeks so we can review your progress.',
    'Thank you, doctor. I will schedule it.',
    'Your latest report looks stable — no change needed for now.',
    'Got it, thanks for reviewing my reports.',
    'Please avoid skipping doses and stay hydrated.',
  ];
  const seenConvos = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    const patient = patientUsers[(i * 3) % patientUsers.length];
    const doctor = doctorUsers[(i * 5) % doctorUsers.length];
    const key = `${patient.patientId}:${doctor.doctorId}`;
    if (seenConvos.has(key)) continue;
    seenConvos.add(key);
    const count = 4 + (i % 4);
    let lastAt = Date.now() - (60 - i * 2) * 3600000;
    const convo = await db.orm.public.Conversation.create({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      lastMessageAt: null,
    });
    ledger.conversations.push(convo.id);
    for (let m = 0; m < count; m += 1) {
      const fromPatient = m % 2 === 0;
      lastAt += (12 + (m % 5) * 7) * 60000;
      const createdAt = new Date(lastAt).toISOString();
      const msg = await db.orm.public.Message.create({
        conversationId: convo.id,
        senderId: fromPatient ? patient.id : doctor.id,
        body: msgLines[(i + m) % msgLines.length],
        readAt: m < count - 1 ? createdAt : null,
        createdAt,
      });
      ledger.messages.push(msg.id);
    }
    await db.orm.public.Conversation.where({ id: convo.id }).update({ lastMessageAt: new Date(lastAt).toISOString() });
  }

  // Demo patient ↔ demo doctor thread with a couple of unread doctor replies.
  {
    const pUser = await db.orm.public.User.where({ email: `patient.demo@${DEMO_EMAIL_DOMAIN}` }).first();
    const dUser = await db.orm.public.User.where({ email: `doctor.demo@${DEMO_EMAIL_DOMAIN}` }).first();
    const pPat = pUser ? await db.orm.public.Patient.where({ userId: pUser.id }).first() : null;
    const pDoc = dUser ? await db.orm.public.Doctor.where({ userId: dUser.id }).first() : null;
    if (pUser && dUser && pPat && pDoc) {
      const convo = await db.orm.public.Conversation.create({
        patientId: pPat.id,
        doctorId: pDoc.id,
        lastMessageAt: null,
      });
      ledger.conversations.push(convo.id);
      const thread: Array<['PATIENT' | 'DOCTOR', string, number, boolean]> = [
        ['PATIENT', 'Hello Dr. Iyer, I have been taking the new tablets for a week now.', 26, true],
        ['DOCTOR', 'That is good to hear. Any dizziness or stomach upset?', 25, true],
        ['PATIENT', 'No side effects so far. My morning readings are around 128.', 5, true],
        ['DOCTOR', 'Great progress. Keep the same dose and we will review next week.', 4, false],
        ['DOCTOR', 'Also please share your latest lab report through the records section.', 3, false],
      ];
      let last = '';
      for (const [who, body, hoursAgo, read] of thread) {
        const createdAt = new Date(Date.now() - hoursAgo * 3600000).toISOString();
        const msg = await db.orm.public.Message.create({
          conversationId: convo.id,
          senderId: who === 'PATIENT' ? pUser.id : dUser.id,
          body,
          readAt: read ? createdAt : null,
          createdAt,
        });
        last = createdAt;
        ledger.messages.push(msg.id);
      }
      await db.orm.public.Conversation.where({ id: convo.id }).update({ lastMessageAt: last });
    }
  }

  await writeLedger(ledger);
  return {
    note: DEMO_NOTE,
    password,
    credentials: {
      admin: `admin@${DEMO_EMAIL_DOMAIN}`,
      patient: `patient.demo@${DEMO_EMAIL_DOMAIN}`,
      doctor: `doctor.demo@${DEMO_EMAIL_DOMAIN}`,
      operator: `ambulance.demo@${DEMO_EMAIL_DOMAIN}`,
      facility: `facility.demo@${DEMO_EMAIL_DOMAIN}`,
    },
    created: Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, v.length])),
  };
}

export async function clearDemoData() {
  const ledger = await readLedger();
  const [allUsers, allPatients, allDoctors, allAmbulances, allAppointments, allRecords, allReportFiles, allEmergencies, allTrips, allLocations, allAvailability, allBloodDonors, allOrganDonors, allBloodRequests, allFeedback, allNotifications, allVerifications, allConversations, allMessages] =
    await Promise.all([
      db.orm.public.User.all(),
      db.orm.public.Patient.all(),
      db.orm.public.Doctor.all(),
      db.orm.public.Ambulance.all(),
      db.orm.public.Appointment.all(),
      db.orm.public.MedicalRecord.all(),
      db.orm.public.ReportFile.all(),
      db.orm.public.EmergencyRequest.all(),
      db.orm.public.Trip.all(),
      db.orm.public.LocationUpdate.all(),
      db.orm.public.DoctorAvailability.all(),
      db.orm.public.BloodDonor.all(),
      db.orm.public.OrganDonor.all(),
      db.orm.public.BloodRequest.all(),
      db.orm.public.Feedback.all(),
      db.orm.public.Notification.all(),
      db.orm.public.VerificationRequest.all(),
      db.orm.public.Conversation.all(),
      db.orm.public.Message.all(),
    ]);

  const userMatches = (email: string) => email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
  const userIds = allUsers.filter((u) => userMatches(u.email)).map((u) => u.id);
  const userSet = new Set(userIds);

  const patientIds = allPatients.filter((p) => userSet.has(p.userId)).map((p) => p.id);
  const doctorIds = allDoctors.filter((d) => userSet.has(d.userId)).map((d) => d.id);
  const ambulanceIds = allAmbulances.filter((a) => a.operatorId && userSet.has(a.operatorId)).map((a) => a.id);
  const emergencyIds = allEmergencies.filter((e) => userSet.has(e.requesterId)).map((e) => e.id);

  const patientSet = new Set(patientIds);
  const doctorSet = new Set(doctorIds);
  const emergencySet = new Set(emergencyIds);
  const conversationIds = allConversations.filter((c) => patientSet.has(c.patientId) || doctorSet.has(c.doctorId)).map((c) => c.id);
  const conversationSet = new Set(conversationIds);
  const tripIds = allTrips.filter((t) => emergencySet.has(t.emergencyRequestId) || ambulanceIds.includes(t.ambulanceId)).map((t) => t.id);
  const tripSet = new Set(tripIds);

  const demoReportFiles = allReportFiles.filter(
    (f) => f.isDemo || patientSet.has(f.patientId) || userSet.has(f.uploadedById),
  );
  for (const f of demoReportFiles) {
    await getStorage().remove(f.storageKey).catch(() => undefined);
  }

  const pick = <T,>(rows: T[], fn: (row: T) => boolean) => rows.filter(fn);

  const groups: Array<[keyof typeof db.orm.public, string[]]> = [
    ['LocationUpdate', pick(allLocations, (u) => tripSet.has(u.tripId)).map((u) => u.id)],
    ['Trip', tripIds],
    ['EmergencyRequest', emergencyIds],
    ['Notification', pick(allNotifications, (n) => userSet.has(n.userId)).map((n) => n.id)],
    ['Feedback', pick(allFeedback, (f) => userSet.has(f.authorId)).map((f) => f.id)],
    ['ReportFile', demoReportFiles.map((f) => f.id)],
    ['MedicalRecord', pick(allRecords, (r) => patientSet.has(r.patientId) || (r.doctorId ? doctorSet.has(r.doctorId) : false)).map((r) => r.id)],
    ['Appointment', pick(allAppointments, (a) => patientSet.has(a.patientId) || doctorSet.has(a.doctorId)).map((a) => a.id)],
    ['DoctorAvailability', pick(allAvailability, (a) => doctorSet.has(a.doctorId)).map((a) => a.id)],
    ['Message', pick(allMessages, (m) => conversationSet.has(m.conversationId)).map((m) => m.id)],
    ['Conversation', conversationIds],
    ['Doctor', doctorIds],
    ['Patient', patientIds],
    ['BloodDonor', pick(allBloodDonors, (d) => userSet.has(d.userId)).map((d) => d.id)],
    ['OrganDonor', pick(allOrganDonors, (d) => userSet.has(d.userId)).map((d) => d.id)],
    ['BloodRequest', pick(allBloodRequests, (r) => userSet.has(r.requesterId)).map((r) => r.id)],
    ['BloodUnit', ledger.bloodUnits],
    ['BedCapacity', ledger.bedCapacities],
    ['VerificationRequest', pick(allVerifications, (v) => userSet.has(v.userId)).map((v) => v.id)],
    ['Ambulance', ambulanceIds],
    ['User', userIds],
  ];

  let removed = 0;
  for (const [model, ids] of groups) {
    for (const id of ids) {
      await (db.orm.public[model] as unknown as { where: (w: { id: string }) => { delete: () => Promise<unknown> } })
        .where({ id })
        .delete()
        .then(() => {
          removed += 1;
        })
        .catch(() => undefined);
    }
  }
  await db.orm.public.PlatformSetting.where({ key: LEDGER_KEY }).delete().catch(() => undefined);
  return { removed, note: DEMO_NOTE };
}

export async function resetDemoData() {
  await clearDemoData();
  return seedDemoData();
}

export async function demoStatus() {
  const ledger = await readLedger();
  const counts = Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, v.length]));
  const total = Object.values(ledger).reduce((n, v) => n + v.length, 0);
  return { seeded: total > 0, counts, note: DEMO_NOTE };
}
