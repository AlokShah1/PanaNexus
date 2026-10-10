import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import app from '../app.js';
import { db } from '../../prisma/db.js';
import { env } from '../config/env.js';
import { localReportsDir } from '../lib/storage.js';

type Res = { status: number; json: any; cookie: string };

async function listenOnRandomPort(): Promise<Server> {
  return new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
}

let dbOk = true;
try {
  await db.orm.public.HealthcareFacility.aggregate((a) => ({ n: a.count() }));
} catch {
  dbOk = false;
}

const server = await listenOnRandomPort();
const addr = server.address() as AddressInfo;
const base = `http://127.0.0.1:${addr.port}`;

let adminJar = '';
if (dbOk && env.ADMIN_PASSWORD) {
  const r = await req('POST', '/api/v1/auth/login', { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  if (r.status === 200) adminJar = r.cookie;
}

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

async function req(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  const setCookie = (res.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  return { status: res.status, json, cookie: setCookie };
}

const UNIQ = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PASSWORD = 'TestPass!123';

function describeIf(ok: boolean, name: string, fn: () => void) {
  (ok ? describe : describe.skip)(name, fn);
}

describeIf(dbOk, 'API integration — health & public contract', () => {
  it('GET /health returns ok', async () => {
    const r = await req('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.json.status).toBe('ok');
  });

  it('unknown route returns NOT_FOUND envelope', async () => {
    const r = await req('GET', '/api/v1/nope');
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe('NOT_FOUND');
  });
});

describeIf(dbOk, 'API integration — verification workflow', () => {
  const email = `it.dr.${UNIQ}@pananexus.local`;
  const license = `IT-LIC-${UNIQ}`;
  let doctorId = '';
  let doctorJar = '';

  it('registers a doctor as PENDING', async () => {
    const r = await req('POST', '/api/v1/auth/register', {
      name: `IT Doc ${UNIQ.slice(-6)}`,
      email,
      password: PASSWORD,
      role: 'DOCTOR',
      phone: '9111222333',
      specialization: 'Cardiology',
      licenseNumber: license,
      bio: 'integration test doctor',
    });
    expect(r.status).toBe(201);
    expect(r.json.data.profile.role).toBe('DOCTOR');
    expect(r.json.data.profile.verificationStatus).toBe('PENDING');
    doctorId = r.json.data.profile.id;
  });

  it('rejects a duplicate license number with 409 LICENSE_TAKEN', async () => {
    const r = await req('POST', '/api/v1/auth/register', {
      name: 'IT Dup',
      email: `it.dup.${UNIQ}@pananexus.local`,
      password: PASSWORD,
      role: 'DOCTOR',
      specialization: 'Cardiology',
      licenseNumber: license,
    });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('LICENSE_TAKEN');
  });

  it('does not expose the pending doctor in the public directory', async () => {
    const r = await req('GET', '/api/v1/doctors');
    expect(r.status).toBe(200);
    const names = r.json.data.map((d: any) => d.name);
    expect(names).not.toContain(`IT Doc ${UNIQ.slice(-6)}`);
  });

  it('logs in and reads own profile', async () => {
    const r = await req('POST', '/api/v1/auth/login', { email, password: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.cookie).toMatch(/session=/);
    doctorJar = r.cookie;
    const me = await req('GET', '/api/v1/auth/me', undefined, doctorJar);
    expect(me.json.data.profile.verificationStatus).toBe('PENDING');
    expect(me.json.data.profile.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password', async () => {
    const r = await req('POST', '/api/v1/auth/login', { email, password: 'WrongPass!999' });
    expect(r.status).toBe(401);
    expect(r.json.error.code).toBe('INVALID_CREDENTIALS');
  });

  describe.skipIf(adminJar === '')('admin approval syncs doctor row and hides license publicly', () => {
    let vid = '';
    let doctorRowId = '';

    it('finds the pending verification as admin and approves it', async () => {
      const list = await req('GET', '/api/v1/admin/verifications?status=PENDING', undefined, adminJar);
      const item = list.json.data.items.find((v: any) => v.user?.id === doctorId);
      expect(item).toBeDefined();
      vid = item.id;
      const approve = await req('POST', `/api/v1/admin/verifications/${vid}/approve`, {}, adminJar);
      expect(approve.status).toBe(200);
      expect(approve.json.data.status).toBe('APPROVED');
    });

    it('marks the doctor VERIFIED with a Doctor row', async () => {
      const me = await req('GET', '/api/v1/auth/me', undefined, doctorJar);
      expect(me.status).toBe(200);
      expect(me.json.data.profile.verificationStatus).toBe('VERIFIED');
      const mine = await req('GET', '/api/v1/doctors/me', undefined, doctorJar);
      expect(mine.status).toBe(200);
      expect(mine.json.data.specialization).toBe('Cardiology');
      doctorRowId = mine.json.data.id;
    });

    it('shows the doctor publicly but never the license number', async () => {
      const r = await req('GET', '/api/v1/doctors');
      const hit = r.json.data.find((d: any) => d.id === doctorRowId);
      expect(hit).toMatchObject({ name: `IT Doc ${UNIQ.slice(-6)}` });
      expect('licenseNumber' in hit).toBe(false);
    });
  });
});

describeIf(dbOk, 'API integration — emergency request lifecycle', () => {
  let patientJar = '';
  let requestId = '';
  const hasGeoFacility = (f: any) =>
    typeof f?.latitude === 'number' && typeof f?.longitude === 'number';

  beforeAll(async () => {
    const r = await req('POST', '/api/v1/auth/register', {
      name: 'IT Patient',
      email: `it.pat.${UNIQ}@pananexus.local`,
      password: PASSWORD,
      role: 'PATIENT',
    });
    expect(r.status).toBe(201);
    const login = await req('POST', '/api/v1/auth/login', {
      email: `it.pat.${UNIQ}@pananexus.local`,
      password: PASSWORD,
    });
    patientJar = login.cookie;
  });

  it('exposes geo-enriched facilities publicly', async () => {
    const r = await req('GET', '/api/v1/facilities');
    expect(r.status).toBe(200);
    expect(r.json.data.some(hasGeoFacility)).toBe(true);
  });

  it('creates a request and cancels it (double cancel → conflict)', async () => {
    const fac = await req('GET', '/api/v1/facilities');
    const geo = fac.json.data.find(hasGeoFacility);
    const create = await req(
      'POST',
      '/api/v1/emergency',
      {
        pickupLatitude: Number(geo.latitude),
        pickupLongitude: Number(geo.longitude),
        pickupAddress: 'Integration test address',
        notes: 'integration smoke',
        category: 'MEDICAL',
        priority: 'HIGH',
      },
      patientJar,
    );
    expect(create.status).toBe(201);
    expect(create.json.data.request.id).toBeTruthy();
    requestId = create.json.data.request.id;

    const detail = await req('GET', `/api/v1/emergency/${requestId}`, undefined, patientJar);
    expect(detail.status).toBe(200);
    expect(detail.json.data.request.id).toBe(requestId);

    const cancel = await req('POST', `/api/v1/emergency/${requestId}/cancel`, { reason: 'test' }, patientJar);
    expect(cancel.status).toBe(200);
    expect(cancel.json.data.status).toBe('CANCELLED');

    const again = await req('POST', `/api/v1/emergency/${requestId}/cancel`, { reason: 'test' }, patientJar);
    expect(again.status >= 400).toBe(true);
  });

  it('rejects an unauthenticated request', async () => {
    const fac = await req('GET', '/api/v1/facilities');
    const geo = fac.json.data.find(hasGeoFacility);
    const r = await req('POST', '/api/v1/emergency', {
      pickupLatitude: geo.latitude,
      pickupLongitude: geo.longitude,
      category: 'INJURY',
      priority: 'LOW',
    });
    expect(r.status).toBe(401);
  });
});

describeIf(dbOk, 'API integration — patient resources', () => {
  let jelly = '';
  beforeAll(async () => {
    const login = await req('POST', '/api/v1/auth/login', {
      email: `it.pat.${UNIQ}@pananexus.local`,
      password: PASSWORD,
    });
    jelly = login.cookie;
    if (!jelly) {
      const register = await req('POST', '/api/v1/auth/register', {
        name: 'IT Patient',
        email: `it.pat.${UNIQ}@pananexus.local`,
        password: PASSWORD,
        role: 'PATIENT',
      });
      expect(register.status).toBe(201);
      const r = await req('POST', '/api/v1/auth/login', {
        email: `it.pat.${UNIQ}@pananexus.local`,
        password: PASSWORD,
      });
      jelly = r.cookie;
    }
  });

  it('returns blood availability with facility info', async () => {
    const r = await req('GET', '/api/v1/blood/availability', undefined, jelly);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.data)).toBe(true);
    if (r.json.data.length > 0) {
      const item = r.json.data[0];
      expect(item.bloodGroup).toBeTruthy();
      expect(item.facility.address).toBeTruthy();
    }
  });

  it('applies a city filter to blood availability', async () => {
    const r = await req('GET', '/api/v1/blood/availability?city=bhopal', undefined, jelly);
    expect(r.status).toBe(200);
    expect(r.json.data.every((i: any) => i.facility?.address?.toLowerCase().includes('bhopal'))).toBe(true);
  });

  it('requires auth for notifications', async () => {
    const anon = await req('GET', '/api/v1/notifications');
    expect(anon.status).toBe(401);
    const authed = await req('GET', '/api/v1/notifications', undefined, jelly);
    expect(authed.status).toBe(200);
  });
});

async function reqMultipart(
  pathname: string,
  fields: Record<string, string>,
  file: { filename: string; contentType: string; bytes: Buffer } | null,
  cookie?: string,
): Promise<Res> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append('file', new Blob([file.bytes], { type: file.contentType }), file.filename);
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${base}${pathname}`, { method: 'POST', headers, body: form });
  const json = await res.json().catch(() => null);
  const setCookie = (res.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  return { status: res.status, json, cookie: setCookie };
}

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1');

describeIf(dbOk, 'API integration — private medical reports', () => {
  const ownerEmail = `it.rep.${UNIQ}@pananexus.local`;
  const strangerEmail = `it.repstranger.${UNIQ}@pananexus.local`;
  let ownerJar = '';
  let strangerJar = '';
  let patientId = '';
  let uploadedId = '';
  let uploadedKey = '';

  beforeAll(async () => {
    await req('POST', '/api/v1/auth/register', { name: 'IT Report Owner', email: ownerEmail, password: PASSWORD, role: 'PATIENT' });
    const owner = await req('POST', '/api/v1/auth/login', { email: ownerEmail, password: PASSWORD });
    ownerJar = owner.cookie;
    const me = await req('GET', '/api/v1/patients/me', undefined, ownerJar);
    patientId = me.json.data?.id ?? '';
    if (!patientId) {
      const created = await req('POST', '/api/v1/patients/me', { phone: '9000000000' }, ownerJar);
      patientId = created.json.data.id;
    }

    await req('POST', '/api/v1/auth/register', { name: 'IT Report Stranger', email: strangerEmail, password: PASSWORD, role: 'PATIENT' });
    const stranger = await req('POST', '/api/v1/auth/login', { email: strangerEmail, password: PASSWORD });
    strangerJar = stranger.cookie;

    const write = await reqMultipart(
      '/api/v1/reports',
      { patientId, category: 'LAB_RESULT', title: 'Blood panel' },
      { filename: 'panel.pdf', contentType: 'application/pdf', bytes: PDF_BYTES },
      ownerJar,
    );
    if (write.status === 201) {
      uploadedId = write.json.data.id;
      const row = await db.orm.public.ReportFile.where({ id: uploadedId }).first();
      uploadedKey = row?.storageKey ?? '';
    }
  });

  afterAll(async () => {
    if (uploadedKey) {
      await fs.promises.rm(path.join(localReportsDir(), uploadedKey), { force: true }).catch(() => undefined);
    }
  });

  it('rejects an anonymous upload', async () => {
    const r = await reqMultipart(
      '/api/v1/reports',
      { patientId, category: 'LAB_RESULT' },
      { filename: 'x.pdf', contentType: 'application/pdf', bytes: PDF_BYTES },
    );
    expect(r.status).toBe(401);
  });

  it('rejects a file whose content does not match its declared type', async () => {
    const r = await reqMultipart(
      '/api/v1/reports',
      { patientId, category: 'LAB_RESULT' },
      { filename: 'fake.png', contentType: 'image/png', bytes: PDF_BYTES },
      ownerJar,
    );
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe('TYPE_MISMATCH');
  });

  it('rejects an unsupported file type', async () => {
    const r = await reqMultipart(
      '/api/v1/reports',
      { patientId, category: 'LAB_RESULT' },
      { filename: 'notes.txt', contentType: 'text/plain', bytes: Buffer.from('hello') },
      ownerJar,
    );
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe('UNSUPPORTED_TYPE');
  });

  it('uploads a valid PDF and stores only metadata', async () => {
    expect(uploadedId).toBeTruthy();
    const r = await req('GET', '/api/v1/reports', undefined, ownerJar);
    expect(r.status).toBe(200);
    const item = r.json.data.items.find((i: any) => i.id === uploadedId);
    expect(item.category).toBe('LAB_RESULT');
    expect(item.mimeType).toBe('application/pdf');
    expect(item.originalFilename).toBe('panel.pdf');
    expect(item.isDemo).toBe(false);
    expect(item.storageKey).toBeUndefined();
  });

  it('denies a stranger from listing or downloading the report', async () => {
    const list = await req('GET', `/api/v1/reports?patientId=${patientId}`, undefined, strangerJar);
    expect(list.status).toBe(403);
    const dl = await req('GET', `/api/v1/reports/${uploadedId}/download`, undefined, strangerJar);
    expect(dl.status).toBe(403);
  });

  it('issues a short-lived signed download URL that serves the file', async () => {
    const r = await req('GET', `/api/v1/reports/${uploadedId}/download`, undefined, ownerJar);
    expect(r.status).toBe(200);
    expect(r.json.data.expiresInSeconds).toBeGreaterThan(0);
    expect(r.json.data.url).toContain('/api/v1/reports/file');

    const file = await fetch(r.json.data.url);
    expect(file.status).toBe(200);
    const body = Buffer.from(await file.arrayBuffer());
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rejects a tampered download link', async () => {
    const r = await req('GET', `/api/v1/reports/${uploadedId}/download`, undefined, ownerJar);
    const url = new URL(r.json.data.url);
    url.searchParams.set('sig', 'deadbeef'.repeat(8));
    const file = await fetch(url.toString());
    expect(file.status).toBe(403);
  });

  it('returns FILE_MISSING when the stored object is gone', async () => {
    expect(uploadedKey).toBeTruthy();
    await fs.promises.rm(path.join(localReportsDir(), uploadedKey), { force: true });
    const r = await req('GET', `/api/v1/reports/${uploadedId}/download`, undefined, ownerJar);
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe('FILE_MISSING');
  });

  it('soft-deletes the report for its uploader', async () => {
    const del = await req('DELETE', `/api/v1/reports/${uploadedId}`, undefined, ownerJar);
    expect(del.status).toBe(200);
    const after = await req('GET', `/api/v1/reports/${uploadedId}/download`, undefined, ownerJar);
    expect(after.status).toBe(404);
  });
});

describeIf(dbOk && !!adminJar, 'API integration — facility bed capacity', () => {
  let facilityId = '';
  const ward = 'ISOLATION';

  beforeAll(async () => {
    const list = await req('GET', '/api/v1/facilities');
    expect(list.status).toBe(200);
    facilityId = list.json.data[0]?.id ?? '';
    if (facilityId) {
      await req('DELETE', `/api/v1/facilities/${facilityId}/beds/${ward}`, undefined, adminJar);
    }
  });

  it('exposes bed availability publicly', async () => {
    const r = await req('GET', `/api/v1/facilities/${facilityId}/beds`);
    expect(r.status).toBe(200);
    expect(typeof r.json.data.summary.availableBeds).toBe('number');
    expect(Array.isArray(r.json.data.wards)).toBe(true);
  });

  it('includes bed availability in the public facility list and detail', async () => {
    const list = await req('GET', '/api/v1/facilities');
    const f = list.json.data.find((x: any) => x.id === facilityId);
    expect(f.beds.availableBeds).toBeGreaterThanOrEqual(0);
    const detail = await req('GET', `/api/v1/facilities/${facilityId}`);
    expect(detail.status).toBe(200);
    expect(typeof detail.json.data.beds.totalBeds).toBe('number');
  });

  it('rejects an anonymous bed update', async () => {
    const r = await req('PUT', `/api/v1/facilities/${facilityId}/beds`, { ward, totalBeds: 4, occupiedBeds: 1 });
    expect(r.status).toBe(401);
  });

  it('rejects a patient from updating beds', async () => {
    const email = `it.bed.${UNIQ}@pananexus.local`;
    const reg = await req('POST', '/api/v1/auth/register', {
      name: 'IT Bed Patient',
      email,
      password: PASSWORD,
      role: 'PATIENT',
    });
    const jar = reg.cookie || (await req('POST', '/api/v1/auth/login', { email, password: PASSWORD })).cookie;
    const r = await req('PUT', `/api/v1/facilities/${facilityId}/beds`, { ward, totalBeds: 4, occupiedBeds: 1 }, jar);
    expect(r.status).toBe(403);
  });

  it('rejects occupied beds exceeding total beds', async () => {
    const r = await req('PUT', `/api/v1/facilities/${facilityId}/beds`, { ward, totalBeds: 2, occupiedBeds: 5 }, adminJar);
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe('VALIDATION_ERROR');
  });

  it('lets an admin upsert a ward and recompute availability', async () => {
    const create = await req(
      'PUT',
      `/api/v1/facilities/${facilityId}/beds`,
      { ward, label: 'Isolation bay', totalBeds: 6, occupiedBeds: 2 },
      adminJar,
    );
    expect(create.status).toBe(200);
    expect(create.json.data.availableBeds).toBe(4);

    const update = await req('PUT', `/api/v1/facilities/${facilityId}/beds`, { ward, totalBeds: 6, occupiedBeds: 5 }, adminJar);
    expect(update.status).toBe(200);
    expect(update.json.data.availableBeds).toBe(1);

    const row = await db.orm.public.BedCapacity.where({ facilityId, ward: ward as never }).first();
    expect(row?.totalBeds).toBe(6);
    expect(row?.occupiedBeds).toBe(5);
  });

  it('removes a ward and then reports it missing', async () => {
    const del = await req('DELETE', `/api/v1/facilities/${facilityId}/beds/${ward}`, undefined, adminJar);
    expect(del.status).toBe(200);
    const again = await req('DELETE', `/api/v1/facilities/${facilityId}/beds/${ward}`, undefined, adminJar);
    expect(again.status).toBe(404);
  });
});

describeIf(dbOk && !!adminJar, 'API integration — session revocation on admin action', () => {
  it('revokes all live sessions when an admin suspends a user', async () => {
    const email = `it.susp.${UNIQ}@pananexus.local`;
    const reg = await req('POST', '/api/v1/auth/register', {
      name: 'IT Suspendee',
      email,
      password: PASSWORD,
      role: 'PATIENT',
    });
    expect(reg.status).toBe(201);
    const userId = reg.json.data.profile.id as string;
    const jar = reg.cookie || (await req('POST', '/api/v1/auth/login', { email, password: PASSWORD })).cookie;

    const before = await req('GET', '/api/v1/patients/me', undefined, jar);
    expect(before.status).toBe(200);

    const susp = await req('POST', `/api/v1/admin/users/${userId}/suspend`, { reason: 'policy violation' }, adminJar);
    expect(susp.status).toBe(200);

    const after = await req('GET', '/api/v1/patients/me', undefined, jar);
    expect(after.status).toBe(401);
    expect(after.json.error.code).toBe('SESSION_EXPIRED');

    await req('POST', `/api/v1/admin/users/${userId}/unsuspend`, {}, adminJar);
  });

  it('revokes the session when an admin rejects a verification request', async () => {
    const email = `it.rej.${UNIQ}@pananexus.local`;
    const reg = await req('POST', '/api/v1/auth/register', {
      name: 'IT Rejectee',
      email,
      password: PASSWORD,
      role: 'DOCTOR',
      specialization: 'Cardiology',
      licenseNumber: `IT-REJ-${UNIQ}`,
    });
    expect(reg.status).toBe(201);
    const jar = reg.cookie || (await req('POST', '/api/v1/auth/login', { email, password: PASSWORD })).cookie;

    const list = await req('GET', '/api/v1/admin/verifications?status=PENDING', undefined, adminJar);
    const item = list.json.data.items.find((v: any) => v.user?.email === email);
    expect(item).toBeTruthy();

    const rej = await req('POST', `/api/v1/admin/verifications/${item.id}/reject`, { reason: 'illegible documents' }, adminJar);
    expect(rej.status).toBe(200);

    const after = await req('GET', '/api/v1/auth/me', undefined, jar);
    expect(after.status).toBe(401);
  });
});

describeIf(dbOk && !!adminJar, 'API integration — secure patient↔doctor messaging', () => {
  let patientJar = '';
  let doctorJar = '';
  let strangerJar = '';
  let doctorId = '';
  let conversationId = '';

  beforeAll(async () => {
    const docEmail = `it.msg.doc.${UNIQ}@pananexus.local`;
    const reg = await req('POST', '/api/v1/auth/register', {
      name: 'IT Msg Doctor',
      email: docEmail,
      password: PASSWORD,
      role: 'DOCTOR',
      specialization: 'Dermatology',
      licenseNumber: `IT-MSG-${UNIQ}`,
    });
    expect(reg.status).toBe(201);
    doctorJar = reg.cookie || (await req('POST', '/api/v1/auth/login', { email: docEmail, password: PASSWORD })).cookie;

    const list = await req('GET', '/api/v1/admin/verifications?status=PENDING', undefined, adminJar);
    const item = list.json.data.items.find((v: any) => v.user?.email === docEmail);
    expect(item).toBeTruthy();
    const appr = await req('POST', `/api/v1/admin/verifications/${item.id}/approve`, {}, adminJar);
    expect(appr.status).toBe(200);
    const me = await req('GET', '/api/v1/doctors/me', undefined, doctorJar);
    expect(me.status).toBe(200);
    doctorId = me.json.data.id;

    const patEmail = `it.msg.pat.${UNIQ}@pananexus.local`;
    const preg = await req('POST', '/api/v1/auth/register', { name: 'IT Msg Patient', email: patEmail, password: PASSWORD, role: 'PATIENT' });
    expect(preg.status).toBe(201);
    patientJar = preg.cookie || (await req('POST', '/api/v1/auth/login', { email: patEmail, password: PASSWORD })).cookie;
    const pprofile = await req('POST', '/api/v1/patients/me', { bloodGroup: 'O+' }, patientJar);
    expect(pprofile.status).toBe(201);

    const strangerEmail = `it.msg.other.${UNIQ}@pananexus.local`;
    const sreg = await req('POST', '/api/v1/auth/register', { name: 'IT Msg Stranger', email: strangerEmail, password: PASSWORD, role: 'PATIENT' });
    expect(sreg.status).toBe(201);
    strangerJar = sreg.cookie || (await req('POST', '/api/v1/auth/login', { email: strangerEmail, password: PASSWORD })).cookie;
  });

  it('rejects an anonymous conversation start', async () => {
    const r = await req('POST', '/api/v1/messages/conversations', { doctorId });
    expect(r.status).toBe(401);
  });

  it('lets a patient start a conversation with a verified doctor', async () => {
    const r = await req('POST', '/api/v1/messages/conversations', { doctorId }, patientJar);
    expect(r.status).toBe(201);
    conversationId = r.json.data.id;
    expect(r.json.data.counterpart).toBeTruthy();
  });

  it('is idempotent — starting again returns the same conversation', async () => {
    const r = await req('POST', '/api/v1/messages/conversations', { doctorId }, patientJar);
    expect(r.status).toBe(201);
    expect(r.json.data.id).toBe(conversationId);
  });

  it('rejects an empty message', async () => {
    const r = await req('POST', `/api/v1/messages/conversations/${conversationId}/messages`, { body: '   ' }, patientJar);
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe('VALIDATION_ERROR');
  });

  it('sends a message and notifies the doctor', async () => {
    const r = await req('POST', `/api/v1/messages/conversations/${conversationId}/messages`, { body: 'Hello doctor, I have a rash.' }, patientJar);
    expect(r.status).toBe(201);
    expect(r.json.data.body).toBe('Hello doctor, I have a rash.');
    const notes = await req('GET', '/api/v1/notifications', undefined, doctorJar);
    expect(notes.json.data.some((n: any) => n.type === 'MESSAGE')).toBe(true);
  });

  it('shows the conversation in the doctor inbox with an unread count', async () => {
    const r = await req('GET', '/api/v1/messages/conversations', undefined, doctorJar);
    expect(r.status).toBe(200);
    const hit = r.json.data.items.find((c: any) => c.id === conversationId);
    expect(hit).toBeTruthy();
    expect(hit.unread).toBeGreaterThanOrEqual(1);
  });

  it('lets the doctor reply and the patient read the thread', async () => {
    const reply = await req('POST', `/api/v1/messages/conversations/${conversationId}/messages`, { body: 'Please share a photo of the affected area.' }, doctorJar);
    expect(reply.status).toBe(201);
    const read = await req('POST', `/api/v1/messages/conversations/${conversationId}/read`, {}, patientJar);
    expect(read.status).toBe(200);
    expect(read.json.data.read).toBeGreaterThanOrEqual(1);
    const thread = await req('GET', `/api/v1/messages/conversations/${conversationId}/messages`, undefined, patientJar);
    expect(thread.json.data.items.length).toBe(2);
  });

  it('denies a stranger from reading or posting to the conversation', async () => {
    const thread = await req('GET', `/api/v1/messages/conversations/${conversationId}/messages`, undefined, strangerJar);
    expect(thread.status).toBe(404);
    const post = await req('POST', `/api/v1/messages/conversations/${conversationId}/messages`, { body: 'sneaky' }, strangerJar);
    expect(post.status).toBe(404);
  });
});