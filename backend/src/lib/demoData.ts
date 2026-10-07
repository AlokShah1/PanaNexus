import { db } from '../../prisma/db.js';
import { hashPassword } from './auth-core.js';

/**
 * Synthetic demo data for presentation and testing ONLY.
 * Every account uses the `@pananexus.local` suffix, and every created row id is
 * recorded in the `demo.data.ledger` PlatformSetting so it can be cleared safely
 * without ever touching real data.
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

const FACILITIES = [
  { name: 'City General Hospital', type: 'HOSPITAL' as const, lat: 23.2333, lng: 77.401, address: '12 Mahatma Gandhi Road, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Emergency', 'ICU', 'Cardiology', 'Orthopaedics', 'Diagnostics'] },
  { name: 'Green Cross Hospital', type: 'HOSPITAL' as const, lat: 23.19, lng: 77.42, address: 'Green Cross Road, Shahpura, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Emergency', 'General Medicine', 'Surgery', 'Diagnostics'] },
  { name: 'Lakeview Children Hospital', type: 'HOSPITAL' as const, lat: 23.258, lng: 77.39, address: 'Lakeview Avenue, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Paediatrics', 'Neonatal', 'Emergency'] },
  { name: 'Sunrise Multispeciality', type: 'HOSPITAL' as const, lat: 23.208, lng: 77.411, address: 'Sunrise Road, Bhopal', emergency: true, hours: 'Open 24 hours', services: ['Emergency', 'Cardiology', 'Neurology', 'ICU'] },
  { name: 'Barahmanda Health Post', type: 'HEALTH_POST' as const, lat: 23.16, lng: 77.39, address: 'Barahmanda, Bhopal', emergency: false, hours: '08:00 - 20:00', services: ['OPD', 'Immunisation', 'Maternity'] },
];

async function ensureFacility(f: (typeof FACILITIES)[number]) {
  const existing = await db.orm.public.HealthcareFacility.where({ name: f.name, address: f.address }).first();
  if (existing) return existing;
  return db.orm.public.HealthcareFacility.create({
    name: f.name,
    type: f.type,
    address: f.address,
    latitude: f.lat,
    longitude: f.lng,
    emergencyAvailable: f.emergency,
    operatingHours: f.hours,
    services: f.services,
  });
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

const PATIENTS = [
  { key: 'aarav', name: 'Aarav Sharma', phone: '9876543210', blood: 'O+', dob: '1992-04-11' },
  { key: 'diya', name: 'Diya Verma', phone: '9876500011', blood: 'A+', dob: '1988-09-23' },
  { key: 'kabir', name: 'Kabir Nair', phone: '9876511223', blood: 'B+', dob: '1999-01-30' },
  { key: 'meera', name: 'Meera Iyer', phone: '9876500192', blood: 'AB-', dob: '1978-07-05' },
  { key: 'rohan', name: 'Rohan Gupta', phone: '9876588121', blood: 'O-', dob: '2001-12-14' },
  { key: 'sara', name: 'Sara Khan', phone: '9876555330', blood: 'A-', dob: '1995-03-19' },
];

const DOCTORS = [
  { key: 'ananya', name: 'Dr. Ananya Rao', spec: 'Cardiology', feeNotes: 'Weekly OP restdays Tuesday.' },
  { key: 'vikram', name: 'Dr. Vikram Menon', spec: 'Emergency Medicine', feeNotes: 'Available for trauma calls.' },
  { key: 'farah', name: 'Dr. Farah Siddiqui', spec: 'Paediatrics', feeNotes: 'Neonatal and child care.' },
];

const OPERATORS = [
  { key: 'suresh', name: 'Suresh Yadav', reg: 'MP04-AM-1001', type: 'ADVANCED' as const, lat: 23.2299, lng: 77.4099, driver: 'Rakesh Kumar', driverPhone: '9876012012' },
  { key: 'imran', name: 'Imran Sheikh', reg: 'MP04-AM-1002', type: 'BASIC' as const, lat: 23.2401, lng: 77.4155, driver: 'Salim Ansari', driverPhone: '9876023013' },
  { key: 'priya', name: 'Priya Deshmukh', reg: 'MP04-AM-1003', type: 'ICU' as const, lat: 23.2135, lng: 77.3987, driver: 'Anil Rathore', driverPhone: '9876034014' },
];

export async function seedDemoData() {
  await clearDemoData();
  const ledger = newLedger();
  const password = process.env.DEMO_PASSWORD ?? process.env.SEED_PASSWORD ?? 'TestPass!123';
  const passwordHash = await hashPassword(password);

  const city = await ensureFacility(FACILITIES[0]);
  const green = await ensureFacility(FACILITIES[1]);
  await ensureFacility(FACILITIES[2]);
  await ensureFacility(FACILITIES[3]);
  await ensureFacility(FACILITIES[4]);

  const patientUsers: { id: string; patientId: string; name: string }[] = [];
  for (const p of PATIENTS) {
    const u = await ensureUser(ledger, passwordHash, {
      email: `${p.key}@${DEMO_EMAIL_DOMAIN}`,
      name: p.name,
      role: 'PATIENT',
      phone: p.phone,
      verificationStatus: 'VERIFIED',
    });
    let patient = await db.orm.public.Patient.where({ userId: u.id }).first();
    if (!patient) {
      patient = await db.orm.public.Patient.create({
        userId: u.id,
        bloodGroup: p.blood,
        dateOfBirth: p.dob,
        phone: p.phone,
      });
      ledger.patients.push(patient.id);
    }
    patientUsers.push({ id: u.id, patientId: patient.id, name: p.name });
  }

  const doctorUsers: { id: string; doctorId: string }[] = [];
  for (const d of DOCTORS) {
    const u = await ensureUser(ledger, passwordHash, {
      email: `${d.key}@${DEMO_EMAIL_DOMAIN}`,
      name: d.name,
      role: 'DOCTOR',
      facilityId: city.id,
      verificationStatus: 'VERIFIED',
    });
    let doctor = await db.orm.public.Doctor.where({ userId: u.id }).first();
    if (!doctor) {
      doctor = await db.orm.public.Doctor.create({
        userId: u.id,
        facilityId: city.id,
        specialization: d.spec,
        licenseNumber: `MP-DEMO-${d.key.toUpperCase()}`,
        bio: d.feeNotes,
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

  await ensureUser(ledger, passwordHash, {
    email: `frontdesk@${DEMO_EMAIL_DOMAIN}`,
    name: 'Neha Joshi',
    role: 'FACILITY_STAFF',
    facilityId: city.id,
    phone: '9876044015',
    verificationStatus: 'VERIFIED',
  });
  await ensureUser(ledger, passwordHash, {
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    name: 'Platform Administrator',
    role: 'ADMIN',
    verificationStatus: 'VERIFIED',
  });

  const operatorUsers: { id: string; ambulanceId: string; lat: number; lng: number }[] = [];
  for (const o of OPERATORS) {
    const u = await ensureUser(ledger, passwordHash, {
      email: `${o.key}@${DEMO_EMAIL_DOMAIN}`,
      name: o.name,
      role: 'AMBULANCE_OPERATOR',
      phone: o.driverPhone,
      verificationStatus: 'VERIFIED',
    });
    let amb = await db.orm.public.Ambulance.where({ registrationNumber: o.reg }).first();
    if (!amb) {
      amb = await db.orm.public.Ambulance.create({
        registrationNumber: o.reg,
        type: o.type,
        status: 'AVAILABLE',
        operatorId: u.id,
        latitude: o.lat,
        longitude: o.lng,
        driverName: o.driver,
        driverPhone: o.driverPhone,
      });
      ledger.ambulances.push(amb.id);
    }
    operatorUsers.push({ id: u.id, ambulanceId: amb.id, lat: o.lat, lng: o.lng });
  }

  // Blood donors
  const donorGroup: Record<string, string> = { aarav: 'O+', diya: 'A+', kabir: 'B+', meera: 'AB-' };
  for (const p of PATIENTS.filter((x) => donorGroup[x.key])) {
    const donorUser = await db.orm.public.User.where({ email: `${p.key}@${DEMO_EMAIL_DOMAIN}` }).first();
    if (!donorUser) continue;
    let donor = await db.orm.public.BloodDonor.where({ userId: donorUser.id }).first();
    if (!donor) {
      donor = await db.orm.public.BloodDonor.create({
        userId: donorUser.id,
        bloodGroup: donorGroup[p.key] as never,
        isAvailable: true,
      });
      ledger.bloodDonors.push(donor.id);
    }
  }

  // Organ donors
  for (const key of ['diya', 'sara']) {
    const u = await db.orm.public.User.where({ email: `${key}@${DEMO_EMAIL_DOMAIN}` }).first();
    if (!u) continue;
    let organ = await db.orm.public.OrganDonor.where({ userId: u.id }).first();
    if (!organ) {
      organ = await db.orm.public.OrganDonor.create({
        userId: u.id,
        organs: ['kidney', 'liver'],
        consent: true,
        status: key === 'sara' ? 'PLEDGED' : 'VERIFIED',
      });
      ledger.organDonors.push(organ.id);
    }
  }

  // Blood stock
  const stock: Record<string, number> = { 'O+': 14, 'O-': 6, 'A+': 11, 'A-': 5, 'B+': 9, 'B-': 3, 'AB+': 4, 'AB-': 2 };
  for (const [group, units] of Object.entries(stock)) {
    const existing = await db.orm.public.BloodUnit.where({ facilityId: city.id, bloodGroup: group as never }).first();
    if (!existing) {
      const unit = await db.orm.public.BloodUnit.create({ facilityId: city.id, bloodGroup: group as never, units });
      ledger.bloodUnits.push(unit.id);
    }
  }

  // Blood requests
  const now = Date.now();
  for (let i = 0; i < 3; i += 1) {
    const requester = patientUsers[i];
    const row = await db.orm.public.BloodRequest.create({
      requesterId: requester.id,
      facilityId: i === 2 ? green.id : city.id,
      bloodGroup: (['O+', 'A+', 'B+'][i]) as never,
      units: 1 + (i % 2),
      status: (['PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED'][i]) as never,
    });
    ledger.bloodRequests.push(row.id);
  }

  // Appointments across statuses
  const apptStatus = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'COMPLETED'] as const;
  for (let i = 0; i < 6; i += 1) {
    const patient = patientUsers[i % patientUsers.length];
    const doctor = doctorUsers[i % doctorUsers.length];
    const row = await db.orm.public.Appointment.create({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      facilityId: city.id,
      startsAt: new Date(now + (i - 2) * 24 * 60 * 60 * 1000).toISOString(),
      status: apptStatus[i % apptStatus.length] as never,
      notes: i % 2 === 0 ? 'Routine follow-up.' : null,
    });
    ledger.appointments.push(row.id);
  }

  // Medical records
  for (let i = 0; i < 4; i += 1) {
    const patient = patientUsers[i % patientUsers.length];
    const doctor = doctorUsers[i % doctorUsers.length];
    const row = await db.orm.public.MedicalRecord.create({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      facilityId: city.id,
      recordType: (['CONSULTATION', 'LAB_RESULT', 'PRESCRIPTION', 'IMAGING'][i]) as never,
      diagnosis: ['Hypertension', 'Viral fever', 'Type 2 diabetes', 'Fracture recovery'][i],
      treatment: 'Medication and rest advised.',
      prescriptions: ['Paracetamol 500mg - twice daily for 5 days'],
      attachments: [],
      notes: DEMO_NOTE,
    });
    ledger.records.push(row.id);
  }

  // Emergency history + one live tracking scenario
  const liveRequest = await db.orm.public.EmergencyRequest.create({
    requesterId: patientUsers[0].id,
    patientId: patientUsers[0].patientId,
    category: 'MEDICAL',
    priority: 'HIGH',
    status: 'EN_ROUTE',
    pickupLatitude: 23.2299,
    pickupLongitude: 77.4099,
    pickupAccuracy: 18,
    pickupObtainedAt: new Date(now - 6 * 60 * 1000).toISOString(),
    pickupAddress: 'Near Board Office, Arera Hills, Bhopal',
    destinationFacilityId: city.id,
    destinationAddress: city.address,
    notes: 'Patient experiencing chest pain.',
  });
  ledger.emergencies.push(liveRequest.id);
  const liveTrip = await db.orm.public.Trip.create({
    emergencyRequestId: liveRequest.id,
    ambulanceId: operatorUsers[0].ambulanceId,
    status: 'EN_ROUTE',
    isSimulation: true,
  });
  ledger.trips.push(liveTrip.id);
  await db.orm.public.Ambulance.where({ id: operatorUsers[0].ambulanceId }).update({ status: 'EN_ROUTE' });
  const pathStart = { lat: 23.2199, lng: 77.3909 };
  for (let i = 1; i <= 3; i += 1) {
    const loc = await db.orm.public.LocationUpdate.create({
      tripId: liveTrip.id,
      latitude: pathStart.lat + ((23.2299 - pathStart.lat) * i) / 4,
      longitude: pathStart.lng + ((77.4099 - pathStart.lng) * i) / 4,
      accuracy: 12,
    });
    ledger.locations.push(loc.id);
  }

  // Open request available for simulation
  const openRequest = await db.orm.public.EmergencyRequest.create({
    requesterId: patientUsers[1].id,
    patientId: patientUsers[1].patientId,
    category: 'ACCIDENT',
    priority: 'CRITICAL',
    status: 'PENDING',
    pickupLatitude: 23.2401,
    pickupLongitude: 77.4155,
    pickupAccuracy: 22,
    pickupObtainedAt: new Date(now - 2 * 60 * 1000).toISOString(),
    pickupAddress: 'Roshanpura Square, Bhopal',
    notes: 'Road traffic accident, conscious.',
  });
  ledger.emergencies.push(openRequest.id);

  // Completed history
  const doneRequest = await db.orm.public.EmergencyRequest.create({
    requesterId: patientUsers[2].id,
    patientId: patientUsers[2].patientId,
    category: 'INJURY',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    pickupLatitude: 23.2051,
    pickupLongitude: 77.4288,
    pickupAccuracy: 30,
    pickupObtainedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    pickupAddress: 'New Market, Bhopal',
  });
  ledger.emergencies.push(doneRequest.id);
  const doneTrip = await db.orm.public.Trip.create({
    emergencyRequestId: doneRequest.id,
    ambulanceId: operatorUsers[2].ambulanceId,
    status: 'COMPLETED',
    arrivedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
    completedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
    endedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
  });
  ledger.trips.push(doneTrip.id);

  // Feedback
  for (let i = 0; i < 4; i += 1) {
    const author = patientUsers[i];
    const row = await db.orm.public.Feedback.create({
      authorId: author.id,
      facilityId: i % 2 === 0 ? city.id : green.id,
      rating: [5, 4, 5, 3][i],
      comment: ['Prompt ambulance response.', 'Clean facility and caring staff.', 'Quick admission process.', 'Waiting time can improve.'][i],
      status: 'APPROVED',
    });
    ledger.feedback.push(row.id);
  }

  // Notifications
  const notes: Array<[string, string, string]> = [
    ['EMERGENCY', 'Ambulance en route', 'Your ambulance is on the way.'],
    ['APPOINTMENT', 'Appointment confirmed', 'Your appointment has been confirmed.'],
    ['BLOOD', 'Blood request approved', 'Your blood request was approved.'],
  ];
  for (const [type, title, body] of notes) {
    const row = await db.orm.public.Notification.create({
      userId: patientUsers[0].id,
      type: type as never,
      title,
      body,
      read: false,
      link: '/dashboard',
    });
    ledger.notifications.push(row.id);
  }

  // Verification queue samples
  const pendingDoctor = await db.orm.public.User.where({ email: `farah@${DEMO_EMAIL_DOMAIN}` }).first();
  if (pendingDoctor) {
    const existing = await db.orm.public.VerificationRequest.where({ userId: pendingDoctor.id }).first();
    if (!existing) {
      const row = await db.orm.public.VerificationRequest.create({
        userId: pendingDoctor.id,
        kind: 'DOCTOR',
        status: 'PENDING',
        payload: JSON.stringify({ specialization: 'Paediatrics', licenseNumber: 'MP-DEMO-FARAH', bio: 'Neonatal and child care.' }),
        documentUrls: ['/uploads/demo/medical-council-certificate.pdf'],
        reason: 'Awaiting council verification.',
      });
      ledger.verifications.push(row.id);
    }
  }

  await writeLedger(ledger);
  return {
    note: DEMO_NOTE,
    password,
    credentials: {
      admin: `admin@${DEMO_EMAIL_DOMAIN}`,
      patient: `aarav@${DEMO_EMAIL_DOMAIN}`,
      operator: `suresh@${DEMO_EMAIL_DOMAIN}`,
      doctor: `ananya@${DEMO_EMAIL_DOMAIN}`,
    },
    created: Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, v.length])),
  };
}

export async function clearDemoData() {
  const ledger = await readLedger();
  const [allUsers, allPatients, allDoctors, allAmbulances, allAppointments, allRecords, allEmergencies, allTrips, allLocations, allAvailability, allBloodDonors, allOrganDonors, allBloodRequests, allFeedback, allNotifications, allVerifications] =
    await Promise.all([
      db.orm.public.User.all(),
      db.orm.public.Patient.all(),
      db.orm.public.Doctor.all(),
      db.orm.public.Ambulance.all(),
      db.orm.public.Appointment.all(),
      db.orm.public.MedicalRecord.all(),
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
  const tripIds = allTrips.filter((t) => emergencySet.has(t.emergencyRequestId) || ambulanceIds.includes(t.ambulanceId)).map((t) => t.id);
  const tripSet = new Set(tripIds);

  const pick = <T,>(rows: T[], fn: (row: T) => boolean) => rows.filter(fn);

  const groups: Array<[keyof typeof db.orm.public, string[]]> = [
    ['LocationUpdate', pick(allLocations, (u) => tripSet.has(u.tripId)).map((u) => u.id)],
    ['Trip', tripIds],
    ['EmergencyRequest', emergencyIds],
    ['Notification', pick(allNotifications, (n) => userSet.has(n.userId)).map((n) => n.id)],
    ['Feedback', pick(allFeedback, (f) => userSet.has(f.authorId)).map((f) => f.id)],
    ['MedicalRecord', pick(allRecords, (r) => patientSet.has(r.patientId) || (r.doctorId ? doctorSet.has(r.doctorId) : false)).map((r) => r.id)],
    ['Appointment', pick(allAppointments, (a) => patientSet.has(a.patientId) || doctorSet.has(a.doctorId)).map((a) => a.id)],
    ['DoctorAvailability', pick(allAvailability, (a) => doctorSet.has(a.doctorId)).map((a) => a.id)],
    ['Doctor', doctorIds],
    ['Patient', patientIds],
    ['BloodDonor', pick(allBloodDonors, (d) => userSet.has(d.userId)).map((d) => d.id)],
    ['OrganDonor', pick(allOrganDonors, (d) => userSet.has(d.userId)).map((d) => d.id)],
    ['BloodRequest', pick(allBloodRequests, (r) => userSet.has(r.requesterId)).map((r) => r.id)],
    ['BloodUnit', ledger.bloodUnits],
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