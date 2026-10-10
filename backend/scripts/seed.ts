import { db } from '../prisma/db.js';
import { seedDemoData } from '../src/lib/demoData.js';
import { demoMode } from '../src/config/env.js';

const DEMO = process.argv.includes('--demo');

const FACILITIES = [
  {
    name: 'City General Hospital',
    address: '12 MG Road, Bhopal',
    type: 'HOSPITAL' as const,
    latitude: 23.2333,
    longitude: 77.401,
    emergencyAvailable: true,
    services: ['Emergency', 'Cardiology', 'Surgery', 'ICU', 'Radiology', 'Pharmacy'],
    operatingHours: 'Open 24 hours',
  },
  {
    name: 'Green Cross Hospital',
    address: '22 Arera Colony, Bhopal',
    type: 'HOSPITAL' as const,
    latitude: 23.19,
    longitude: 77.42,
    emergencyAvailable: true,
    services: ['General Medicine', 'Surgery', 'Orthopedics', 'Pathology'],
    operatingHours: 'Mon–Sun 09:00–21:00',
  },
  {
    name: 'Lakeview Children Hospital',
    address: '7 Kolar Road, Bhopal',
    type: 'HOSPITAL' as const,
    latitude: 23.258,
    longitude: 77.39,
    emergencyAvailable: true,
    services: ['Pediatrics', 'Neonatal ICU', 'Vaccination', 'OPD'],
    operatingHours: 'Open 24 hours',
  },
  {
    name: 'Sunrise Multispeciality Hospital',
    address: '45 MP Nagar Zone 2, Bhopal',
    type: 'HOSPITAL' as const,
    latitude: 23.208,
    longitude: 77.411,
    emergencyAvailable: true,
    services: ['Multispeciality', 'Orthopedics', 'Maternity', 'Pharmacy', 'Pathology'],
    operatingHours: 'Mon–Sat 08:00–20:00',
  },
  {
    name: 'Barahmanda Health Post',
    address: 'Barahmanda chowk, Bhopal',
    type: 'HEALTH_POST' as const,
    latitude: 23.16,
    longitude: 77.39,
    emergencyAvailable: false,
    services: ['OPD', 'Immunization', 'Family welfare'],
    operatingHours: 'Tue–Sun 09:00–16:00',
  },
  {
    name: 'Govindpura Health Post',
    address: 'Govindpura industrial area, Bhopal',
    type: 'HEALTH_POST' as const,
    latitude: 23.245,
    longitude: 77.44,
    emergencyAvailable: false,
    services: ['OPD', 'Maternity', 'Immunization', 'Pathology'],
    operatingHours: 'Mon–Sat 08:30–16:30',
  },
  {
    name: 'Neelbad Community Health Post',
    address: 'Neelbad village road, Bhopal',
    type: 'HEALTH_POST' as const,
    latitude: 23.29,
    longitude: 77.35,
    emergencyAvailable: false,
    services: ['OPD', 'First aid', 'Elementary care'],
    operatingHours: 'Mon–Fri 09:00–15:00',
  },
  {
    name: 'Shantipur Health Post',
    address: 'Shantipur, Kolar, Bhopal',
    type: 'HEALTH_POST' as const,
    latitude: 23.27,
    longitude: 77.31,
    emergencyAvailable: false,
    services: ['OPD', 'First aid', 'Immunization'],
    operatingHours: 'Mon–Fri 09:00–17:00',
  },
];

async function ensureFacility(f: (typeof FACILITIES)[number]) {
  const existing = await db.orm.public.HealthcareFacility.where({ name: f.name, address: f.address }).first();
  if (existing) return existing;
  const row = await db.orm.public.HealthcareFacility.create({
    name: f.name,
    address: f.address,
    type: f.type,
    latitude: f.latitude,
    longitude: f.longitude,
    emergencyAvailable: f.emergencyAvailable,
    services: f.services,
    operatingHours: f.operatingHours,
  });
  console.log('facility:', f.name);
  return row;
}

async function main() {
  if (DEMO && !demoMode) {
    console.error(
      'Refusing to seed demo data: DEMO_MODE is not enabled. ' +
        'Set DEMO_MODE=true (dev/demo environments only) and retry.',
    );
    process.exit(1);
  }

  for (const f of FACILITIES) {
    await ensureFacility(f);
  }

  if (!DEMO) {
    console.log('Facilities ready. Run with --demo to add the full synthetic demo dataset.');
    return;
  }

  const result = await seedDemoData();
  console.log('Demo data seeded (synthetic).');
  console.log(`Demo password: ${result.password}`);
  console.log('Demo logins:', result.credentials);
  console.log('Created:', result.created);
  console.log(result.note);
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));