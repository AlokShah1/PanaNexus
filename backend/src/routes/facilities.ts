import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { facilitySchema } from '../validations/healthcare';

const router = Router();

router.get('/', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const rows = await db.orm.public.HealthcareFacility.all();
  const filtered = type ? rows.filter((f) => f.type === type) : rows;
  return ok(res, filtered.slice(0, 100).map((f) => ({ id: f.id, name: f.name, type: f.type, address: f.address, phone: f.phone, operatingHours: f.operatingHours })));
});

router.post('/', async (req, res) => {
  const session = getSession(req);
  if (!session || (session.role !== 'FACILITY_STAFF' && session.role !== 'ADMIN')) return fail(res, 'FORBIDDEN', 'Only facility staff or admins can create facilities.', 403);
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const facility = await db.orm.public.HealthcareFacility.create(parsed.data);
  await db.orm.public.AuditLog.create({ action: 'FACILITY_CREATED', entity: 'HealthcareFacility', entityId: facility.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: facility.id }, 201);
});

export default router;
