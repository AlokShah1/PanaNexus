import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { env } from '../config/env.js';
import { getUser, requireAuth, type SessionUser } from '../middleware/auth.js';
import { parsePage, pageMeta } from '../lib/pagination.js';
import {
  getStorage,
  readLocalObject,
  verifyLocalDownloadToken,
} from '../lib/storage.js';

const router = Router();

const CATEGORIES = ['MEDICAL_REPORT', 'LAB_RESULT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

/** MIME type → canonical file extension for the allowed private report formats. */
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.REPORT_MAX_FILE_BYTES, files: 1 },
});

function handleUpload(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      fail(
        res,
        tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED',
        tooBig
          ? `Files must be at most ${Math.round(env.REPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`
          : 'The upload could not be processed.',
        422,
      );
      return;
    }
    next();
  });
}

/** Sniff the real content type from the file signature so a renamed file can't slip through. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 8 && png.every((b, i) => buf[i] === b)) return 'image/png';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Keep only a safe basename; reject names with separators or control characters. */
function sanitizeFilename(raw: string): { name: string } | { error: string } {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return { error: 'The file name is not valid.' };
  if (cleaned.length > 200) return { error: 'The file name is too long.' };
  if (base !== raw && raw.includes('\u0000')) return { error: 'The file name is not valid.' };
  return { name: cleaned };
}

type FileValidation =
  | { ok: true; mime: string; ext: string; filename: string; size: number }
  | { ok: false; code: string; message: string };

function validateReportFile(file: Express.Multer.File): FileValidation {
  const clean = sanitizeFilename(file.originalname);
  if ('error' in clean) return { ok: false, code: 'INVALID_FILENAME', message: clean.error };
  if (file.size <= 0) return { ok: false, code: 'EMPTY_FILE', message: 'The file is empty.' };

  const declaredExt = path.extname(clean.name).toLowerCase();
  const declaredMime = (file.mimetype || '').toLowerCase();
  const expectedExt = ALLOWED_TYPES[declaredMime];
  if (!expectedExt) {
    return { ok: false, code: 'UNSUPPORTED_TYPE', message: 'Only PDF, JPEG, PNG, and WebP files are allowed.' };
  }
  const sniffed = sniffMime(file.buffer);
  if (!sniffed) {
    return { ok: false, code: 'UNSUPPORTED_TYPE', message: 'The file content is not a supported type.' };
  }
  if (sniffed !== declaredMime) {
    return { ok: false, code: 'TYPE_MISMATCH', message: 'The file content does not match its declared type.' };
  }
  if (declaredExt && declaredExt !== expectedExt && !(expectedExt === '.jpg' && declaredExt === '.jpeg')) {
    return { ok: false, code: 'INVALID_FILENAME', message: 'The file extension does not match its type.' };
  }
  return { ok: true, mime: declaredMime, ext: expectedExt, filename: clean.name, size: file.size };
}

/* -------------------------------------------------------------------------- */
/* Authorization                                                              */
/* -------------------------------------------------------------------------- */

type Access = 'ok' | 'not_found' | 'forbidden';

async function patientAccess(user: SessionUser, patientId: string): Promise<Access> {
  const patient = await db.orm.public.Patient.where({ id: patientId }).first();
  if (!patient) return 'not_found';
  if (user.role === 'ADMIN') return 'ok';
  if (user.role === 'PATIENT') return patient.userId === user.id ? 'ok' : 'forbidden';
  if (user.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    if (!doctor) return 'forbidden';
    const appointment = await db.orm.public.Appointment.where({ doctorId: doctor.id, patientId }).first();
    if (appointment) return 'ok';
    const record = await db.orm.public.MedicalRecord.where({ doctorId: doctor.id, patientId }).first();
    return record ? 'ok' : 'forbidden';
  }
  if (user.role === 'FACILITY_STAFF') {
    if (!user.facilityId) return 'forbidden';
    const record = await db.orm.public.MedicalRecord.where({ patientId, facilityId: user.facilityId }).first();
    return record ? 'ok' : 'forbidden';
  }
  return 'forbidden';
}

async function ownPatientId(user: SessionUser): Promise<string | null> {
  if (user.role !== 'PATIENT') return null;
  const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
  return patient?.id ?? null;
}

function viewFile(r: {
  id: string;
  patientId: string;
  recordId: string | null;
  uploadedById: string;
  category: string;
  title: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  isDemo: boolean;
  createdAt: string;
}) {
  return {
    id: r.id,
    patientId: r.patientId,
    recordId: r.recordId,
    uploadedById: r.uploadedById,
    category: r.category,
    title: r.title,
    originalFilename: r.originalFilename,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    checksumSha256: r.checksumSha256,
    isDemo: r.isDemo,
    createdAt: r.createdAt,
  };
}

async function audit(action: string, entityId: string, actorId: string, metadata?: string): Promise<void> {
  await db.orm.public.AuditLog.create({
    action,
    entity: 'ReportFile',
    entityId,
    actorId,
    metadata: metadata ?? null,
  }).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.post('/', requireAuth, handleUpload, async (req, res) => {
  const user = getUser(req);
  const file = req.file;
  if (!file) return fail(res, 'NO_FILE', 'Attach a file to upload.', 422);

  const patientId = typeof req.body?.patientId === 'string' ? req.body.patientId.trim() : '';
  if (!patientId) return fail(res, 'VALIDATION_ERROR', 'A patient must be selected.', 422);

  const rawCategory = typeof req.body?.category === 'string' ? req.body.category.toUpperCase() : 'MEDICAL_REPORT';
  if (!CATEGORIES.includes(rawCategory as Category)) {
    return fail(res, 'VALIDATION_ERROR', 'Unknown report category.', 422);
  }
  const category = rawCategory as Category;

  const access = await patientAccess(user, patientId);
  if (access === 'not_found') return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
  if (access !== 'ok') return fail(res, 'FORBIDDEN', 'You cannot add reports for this patient.', 403);

  const validation = validateReportFile(file);
  if (!validation.ok) return fail(res, validation.code, validation.message, 422);

  let recordId: string | null = null;
  if (typeof req.body?.recordId === 'string' && req.body.recordId.trim()) {
    const record = await db.orm.public.MedicalRecord.where({ id: req.body.recordId.trim() }).first();
    if (!record || record.patientId !== patientId) {
      return fail(res, 'VALIDATION_ERROR', 'The linked record does not belong to this patient.', 422);
    }
    recordId = record.id;
  }

  const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 200) : null;
  const storageKey = `reports/${patientId}/${randomUUID()}${validation.ext}`;

  await getStorage().put(storageKey, file.buffer, validation.mime);

  const row = await db.orm.public.ReportFile.create({
    patientId,
    recordId,
    uploadedById: user.id,
    category,
    title,
    originalFilename: validation.filename,
    storageKey,
    mimeType: validation.mime,
    sizeBytes: validation.size,
    checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
    isDemo: false,
  });

  await audit('MEDICAL_REPORT_UPLOADED', row.id, user.id, JSON.stringify({ category, sizeBytes: validation.size }));
  return ok(res, viewFile(row), 201);
});

router.get('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const requested = typeof req.query.patientId === 'string' ? req.query.patientId.trim() : '';

  let patientId = requested;
  if (!patientId) {
    const own = await ownPatientId(user);
    if (own) patientId = own;
  }
  if (!patientId) {
    if (user.role === 'ADMIN') {
      const p = parsePage(req.query as Record<string, unknown>, 20, 100);
      const rows = await db.orm.public.ReportFile.where({ deletedAt: null } as never)
        .orderBy((x) => x.createdAt.desc())
        .offset(p.offset)
        .limit(p.limit)
        .all();
      const total = await db.orm.public.ReportFile.where({ deletedAt: null } as never).aggregate((a) => ({ total: a.count() }));
      return ok(res, { items: rows.map(viewFile), meta: pageMeta(p, total.total) });
    }
    return fail(res, 'VALIDATION_ERROR', 'A patient must be selected.', 422);
  }

  const access = await patientAccess(user, patientId);
  if (access === 'not_found') return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
  if (access !== 'ok') return fail(res, 'FORBIDDEN', 'You cannot view reports for this patient.', 403);

  const rows = await db.orm.public.ReportFile.where({ patientId } as never)
    .orderBy((x) => x.createdAt.desc())
    .all();
  const visible = rows.filter((r) => !r.deletedAt);
  return ok(res, { items: visible.map(viewFile) });
});

router.get('/:id/download', requireAuth, async (req, res) => {
  const user = getUser(req);
  const row = await db.orm.public.ReportFile.where({ id: req.params.id }).first();
  if (!row || row.deletedAt) return fail(res, 'NOT_FOUND', 'Report not found.', 404);

  const access = await patientAccess(user, row.patientId);
  if (access !== 'ok') {
    await audit('MEDICAL_REPORT_ACCESS_DENIED', row.id, user.id);
    return fail(res, 'FORBIDDEN', 'You cannot access this report.', 403);
  }

  const head = await getStorage().head(row.storageKey);
  if (!head.exists) {
    await audit('MEDICAL_REPORT_MISSING', row.id, user.id);
    return fail(res, 'FILE_MISSING', 'The file is no longer available.', 404);
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url = await getStorage().presignGet(row.storageKey, {
    expiresInSeconds: env.REPORT_URL_TTL_SECONDS,
    downloadFilename: row.originalFilename,
    contentType: row.mimeType,
    baseUrl,
  });

  await audit('MEDICAL_REPORT_DOWNLOADED', row.id, user.id);
  return ok(res, {
    url,
    expiresInSeconds: env.REPORT_URL_TTL_SECONDS,
    filename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
  });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const user = getUser(req);
  const row = await db.orm.public.ReportFile.where({ id: req.params.id }).first();
  if (!row || row.deletedAt) return fail(res, 'NOT_FOUND', 'Report not found.', 404);

  const canDelete = user.role === 'ADMIN' || row.uploadedById === user.id;
  if (!canDelete) return fail(res, 'FORBIDDEN', 'You cannot delete this report.', 403);

  await getStorage().remove(row.storageKey).catch(() => undefined);
  await db.orm.public.ReportFile.where({ id: row.id }).update({ deletedAt: new Date().toISOString() });
  await audit('MEDICAL_REPORT_DELETED', row.id, user.id);
  return ok(res, { deleted: true, id: row.id });
});

/** Local-driver download endpoint. Possession of a valid signed token grants access. */
router.get('/file', (req, res) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  const name = typeof req.query.name === 'string' ? req.query.name : '';
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  const exp = Number(req.query.exp);

  const verdict = verifyLocalDownloadToken({ key, exp, name, sig });
  if (verdict === 'expired') return fail(res, 'URL_EXPIRED', 'This download link has expired.', 410);
  if (verdict !== 'ok') return fail(res, 'INVALID_URL', 'This download link is not valid.', 403);
  if (getStorage().driver !== 'local') return fail(res, 'NOT_FOUND', 'Not found.', 404);

  const buf = readLocalObject(key);
  if (!buf) return fail(res, 'FILE_MISSING', 'The file is no longer available.', 404);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buf);
});

export default router;
