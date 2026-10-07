import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { notify } from '../lib/notify.js';
import { getUser, requireAuth, requireRole } from '../middleware/auth.js';
import { getAnalytics } from '../lib/analytics.js';
import { pageMeta, parsePage } from '../lib/pagination.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

const SETTING_KEYS = ['maintenanceMode', 'supportEmail', 'emergencyDispatchPhone'] as const;

router.get('/analytics', async (_req, res) => {
  return ok(res, await getAnalytics());
});

/* ---------------------------------------------------- verification queue */

router.get('/verifications', async (req, res) => {
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const base = status ? db.orm.public.VerificationRequest.where({ status: status as never }) : db.orm.public.VerificationRequest;
  const total = await base.aggregate((a) => ({ total: a.count() }));
  const rows = await base
    .orderBy((r) => r.createdAt.desc())
    .limit(p.limit)
    .offset(p.offset)
    .include('user')
    .all();
  const items = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    reason: r.reason,
    payload: safeJson(r.payload),
    documentUrls: r.documentUrls,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email, role: r.user.role, verificationStatus: r.user.verificationStatus } : null,
  }));
  return ok(res, { items, meta: pageMeta(p, total.total) });
});

function safeJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function loadRequest(id: string) {
  const request = await db.orm.public.VerificationRequest.where({ id }).first();
  if (!request) return null;
  const user = await db.orm.public.User.where({ id: request.userId }).first();
  return { request, user };
}

router.post('/verifications/:id/approve', async (req, res) => {
  const admin = getUser(req);
  const loaded = await loadRequest(req.params.id);
  if (!loaded) return fail(res, 'NOT_FOUND', 'Verification request not found.', 404);
  const { request, user } = loaded;
  if (request.status !== 'PENDING') return fail(res, 'INVALID_STATE', 'This request has already been reviewed.', 409);
  if (!user) return fail(res, 'NOT_FOUND', 'User not found.', 404);

  const payload = safeJson(request.payload) as Record<string, unknown> | null;
  if (request.kind === 'FACILITY' && payload && !user.facilityId) {
    const facility = await db.orm.public.HealthcareFacility.create({
      name: String(payload.facilityName ?? 'Health facility'),
      type: payload.facilityType === 'HEALTH_POST' ? 'HEALTH_POST' : 'HOSPITAL',
      address: String(payload.facilityAddress ?? ''),
      phone: payload.facilityPhone ? String(payload.facilityPhone) : null,
      operatingHours: payload.operatingHours ? String(payload.operatingHours) : null,
      services: [],
      emergencyAvailable: false,
    });
    await db.orm.public.User.where({ id: user.id }).update({ facilityId: facility.id });
  }
  if (request.kind === 'DOCTOR' && payload) {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    const nextLicense = payload.licenseNumber ? String(payload.licenseNumber) : null;
    if (nextLicense) {
      const dup = await db.orm.public.Doctor.where({ licenseNumber: nextLicense }).first();
      if (dup && dup.userId !== user.id) {
        return fail(res, 'LICENSE_TAKEN', 'Another doctor already uses that license number.', 409);
      }
    }
    const sync: Record<string, unknown> = {};
    if (payload.specialization !== undefined) sync.specialization = String(payload.specialization);
    if (nextLicense) sync.licenseNumber = nextLicense;
    if (payload.bio !== undefined) sync.bio = String(payload.bio);
    if (!doctor) {
      await db.orm.public.Doctor.create({
        userId: user.id,
        specialization: payload.specialization ? String(payload.specialization) : null,
        licenseNumber: nextLicense,
        bio: payload.bio ? String(payload.bio) : null,
      });
    } else if (Object.keys(sync).length) {
      await db.orm.public.Doctor.where({ userId: user.id }).update(sync as never);
    }
  }
  await db.orm.public.VerificationRequest.where({ id: request.id }).update({
    status: 'APPROVED',
    reason: null,
    reviewedById: admin.id,
    reviewedAt: new Date().toISOString(),
  });
  await db.orm.public.User.where({ id: user.id }).update({ verificationStatus: 'VERIFIED' });
  await db.orm.public.AuditLog.create({
    action: 'VERIFICATION_APPROVED',
    entity: 'VerificationRequest',
    entityId: request.id,
    actorId: admin.id,
    metadata: JSON.stringify({ userId: user.id, kind: request.kind }),
  }).catch(() => undefined);
  await notify(user.id, {
    type: 'VERIFICATION',
    title: 'Account verified',
    body: 'Your credentials were approved. All features are now unlocked.',
    link: '/dashboard',
  });
  return ok(res, { id: request.id, status: 'APPROVED', userId: user.id });
});

router.post('/verifications/:id/reject', async (req, res) => {
  const admin = getUser(req);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return fail(res, 'VALIDATION_ERROR', 'A reason is required to reject a request.', 422);
  const loaded = await loadRequest(req.params.id);
  if (!loaded) return fail(res, 'NOT_FOUND', 'Verification request not found.', 404);
  const { request, user } = loaded;
  if (request.status !== 'PENDING') return fail(res, 'INVALID_STATE', 'This request has already been reviewed.', 409);
  if (!user) return fail(res, 'NOT_FOUND', 'User not found.', 404);
  await db.orm.public.VerificationRequest.where({ id: request.id }).update({
    status: 'REJECTED',
    reason,
    reviewedById: admin.id,
    reviewedAt: new Date().toISOString(),
  });
  await db.orm.public.User.where({ id: user.id }).update({ verificationStatus: 'REJECTED' });
  await db.orm.public.AuditLog.create({
    action: 'VERIFICATION_REJECTED',
    entity: 'VerificationRequest',
    entityId: request.id,
    actorId: admin.id,
    metadata: JSON.stringify({ userId: user.id, reason }),
  }).catch(() => undefined);
  await notify(user.id, {
    type: 'VERIFICATION',
    title: 'Verification needs changes',
    body: reason,
    link: '/verification',
  });
  return ok(res, { id: request.id, status: 'REJECTED', userId: user.id });
});

router.post('/verifications/:id/request-info', async (req, res) => {
  const admin = getUser(req);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return fail(res, 'VALIDATION_ERROR', 'Describe what information is needed.', 422);
  const loaded = await loadRequest(req.params.id);
  if (!loaded) return fail(res, 'NOT_FOUND', 'Verification request not found.', 404);
  const { request, user } = loaded;
  if (request.status !== 'PENDING') return fail(res, 'INVALID_STATE', 'This request has already been reviewed.', 409);
  if (!user) return fail(res, 'NOT_FOUND', 'User not found.', 404);
  await db.orm.public.VerificationRequest.where({ id: request.id }).update({ reason });
  await db.orm.public.AuditLog.create({
    action: 'VERIFICATION_INFO_REQUESTED',
    entity: 'VerificationRequest',
    entityId: request.id,
    actorId: admin.id,
    metadata: JSON.stringify({ userId: user.id, reason }),
  }).catch(() => undefined);
  await notify(user.id, {
    type: 'VERIFICATION',
    title: 'More information needed',
    body: reason,
    link: '/verification',
  });
  return ok(res, { id: request.id, status: 'PENDING', reason });
});

/* ------------------------------------------------------------------ users */

router.get('/users', async (req, res) => {
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rows = await db.orm.public.User.all();
  let filtered = rows;
  if (role) filtered = filtered.filter((u) => u.role === role);
  if (status) filtered = filtered.filter((u) => u.verificationStatus === status);
  if (q) filtered = filtered.filter((u) => u.email.includes(q) || u.name.toLowerCase().includes(q));
  const total = filtered.length;
  const items = filtered
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(p.offset, p.offset + p.limit)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      verificationStatus: u.verificationStatus,
      phone: u.phone,
      facilityId: u.facilityId,
      createdAt: u.createdAt,
    }));
  return ok(res, { items, meta: pageMeta(p, total) });
});

router.post('/users/:id/suspend', async (req, res) => {
  const admin = getUser(req);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return fail(res, 'VALIDATION_ERROR', 'A reason is required to suspend a user.', 422);
  const target = await db.orm.public.User.where({ id: req.params.id }).first();
  if (!target) return fail(res, 'NOT_FOUND', 'User not found.', 404);
  if (target.id === admin.id) return fail(res, 'FORBIDDEN', 'You cannot suspend your own account.', 403);
  if (target.verificationStatus === 'SUSPENDED') return fail(res, 'INVALID_STATE', 'User is already suspended.', 409);
  await db.orm.public.User.where({ id: target.id }).update({ verificationStatus: 'SUSPENDED' });
  await db.orm.public.AuditLog.create({
    action: 'USER_SUSPENDED',
    entity: 'User',
    entityId: target.id,
    actorId: admin.id,
    metadata: JSON.stringify({ reason, previousStatus: target.verificationStatus }),
  }).catch(() => undefined);
  await notify(target.id, {
    type: 'ACCOUNT',
    title: 'Account suspended',
    body: reason,
    link: '/dashboard',
  });
  return ok(res, { id: target.id, verificationStatus: 'SUSPENDED' });
});

router.post('/users/:id/unsuspend', async (req, res) => {
  const admin = getUser(req);
  const target = await db.orm.public.User.where({ id: req.params.id }).first();
  if (!target) return fail(res, 'NOT_FOUND', 'User not found.', 404);
  if (target.verificationStatus !== 'SUSPENDED') return fail(res, 'INVALID_STATE', 'User is not suspended.', 409);
  const logs = await db.orm.public.AuditLog.where({ entityId: target.id, action: 'USER_SUSPENDED' as never }).orderBy((l) => l.createdAt.desc()).limit(1).all();
  let previous = 'VERIFIED';
  if (logs[0]?.metadata) {
    try {
      const parsed = JSON.parse(logs[0].metadata) as { previousStatus?: string };
      if (parsed.previousStatus) previous = parsed.previousStatus;
    } catch {
      /* keep default */
    }
  }
  if (previous === 'SUSPENDED') previous = 'VERIFIED';
  await db.orm.public.User.where({ id: target.id }).update({ verificationStatus: previous as never });
  await db.orm.public.AuditLog.create({
    action: 'USER_UNSUSPENDED',
    entity: 'User',
    entityId: target.id,
    actorId: admin.id,
    metadata: JSON.stringify({ restoredStatus: previous }),
  }).catch(() => undefined);
  await notify(target.id, { type: 'ACCOUNT', title: 'Account restored', body: 'Your account is active again.', link: '/dashboard' });
  return ok(res, { id: target.id, verificationStatus: previous });
});

/* ------------------------------------------------------------- audit logs */

router.get('/audit', async (req, res) => {
  const p = parsePage(req.query as Record<string, unknown>, 30, 100);
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const base = action ? db.orm.public.AuditLog.where({ action: action as never }) : db.orm.public.AuditLog;
  const total = await base.aggregate((a) => ({ total: a.count() }));
  const rows = await base.orderBy((l) => l.createdAt.desc()).limit(p.limit).offset(p.offset).include('actor').all();
  const items = rows.map((l) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    metadata: safeJson(l.metadata),
    actor: l.actor ? { id: l.actor.id, name: l.actor.name, email: l.actor.email } : null,
    createdAt: l.createdAt,
  }));
  return ok(res, { items, meta: pageMeta(p, total.total) });
});

/* --------------------------------------------------------- feedback queue */

router.get('/feedback', async (req, res) => {
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const base = status ? db.orm.public.Feedback.where({ status: status as never }) : db.orm.public.Feedback;
  const total = await base.aggregate((a) => ({ total: a.count() }));
  const rows = await base
    .orderBy((f) => f.createdAt.desc())
    .limit(p.limit)
    .offset(p.offset)
    .include('author')
    .include('facility')
    .all();
  const items = rows.map((f) => ({
    id: f.id,
    rating: f.rating,
    comment: f.comment,
    status: f.status,
    moderationReason: f.moderationReason,
    facility: f.facility ? { id: f.facility.id, name: f.facility.name } : null,
    author: f.author ? { id: f.author.id, name: f.author.name } : null,
    createdAt: f.createdAt,
  }));
  return ok(res, { items, meta: pageMeta(p, total.total) });
});

router.post('/feedback/:id/moderate', async (req, res) => {
  const admin = getUser(req);
  const status = req.body?.status;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null;
  if (status !== 'APPROVED' && status !== 'REJECTED' && status !== 'PENDING') {
    return fail(res, 'VALIDATION_ERROR', 'Status must be APPROVED, REJECTED or PENDING.', 422);
  }
  if (status === 'REJECTED' && !reason) return fail(res, 'VALIDATION_ERROR', 'A reason is required to reject feedback.', 422);
  const row = await db.orm.public.Feedback.where({ id: req.params.id }).first();
  if (!row) return fail(res, 'NOT_FOUND', 'Feedback not found.', 404);
  await db.orm.public.Feedback.where({ id: row.id }).update({ status, moderationReason: reason });
  await db.orm.public.AuditLog.create({
    action: 'FEEDBACK_MODERATED',
    entity: 'Feedback',
    entityId: row.id,
    actorId: admin.id,
    metadata: JSON.stringify({ status, reason }),
  }).catch(() => undefined);
  return ok(res, { id: row.id, status });
});

/* --------------------------------------------------------- platform config */

router.get('/settings', async (_req, res) => {
  const rows = await db.orm.public.PlatformSetting.all();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  for (const key of SETTING_KEYS) if (!(key in out)) out[key] = key === 'maintenanceMode' ? 'false' : '';
  return ok(res, { settings: out });
});

router.put('/settings', async (req, res) => {
  const admin = getUser(req);
  const body = (req.body?.settings ?? {}) as Record<string, unknown>;
  const applied: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    if (!(key in body)) continue;
    const value = String(body[key] ?? '').slice(0, 300);
    await db.orm.public.PlatformSetting.upsert({
      create: { key, value },
      update: { value },
    });
    applied[key] = value;
  }
  if (Object.keys(applied).length === 0) return fail(res, 'VALIDATION_ERROR', 'No valid settings provided.', 422);
  await db.orm.public.AuditLog.create({
    action: 'SETTINGS_UPDATED',
    entity: 'PlatformSetting',
    entityId: 'platform',
    actorId: admin.id,
    metadata: JSON.stringify(applied),
  }).catch(() => undefined);
  return ok(res, { settings: applied });
});

export default router;
