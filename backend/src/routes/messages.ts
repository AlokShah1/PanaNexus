import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, type SessionUser } from '../middleware/auth.js';
import { sendMessageSchema, startConversationSchema } from '../validations/healthcare.js';
import { notify } from '../lib/notify.js';
import { emitToUser } from '../lib/realtime.js';
import { pageMeta, parsePage } from '../lib/pagination.js';

const router = Router();

router.use(requireAuth);

type ConversationRow = any;
type MessageRow = any;

/**
 * Private, participant-only messaging between a patient and a doctor. No admin
 * or third-party access: a request is authorised only when the caller's user id
 * owns one side of the conversation. Bodies are never written to logs or audit
 * records, and notifications carry no message content.
 */

async function resolveActor(user: SessionUser): Promise<
  | { ok: true; role: 'PATIENT' | 'DOCTOR'; patient: any | null; doctor: any | null }
  | { ok: false }
> {
  if (user.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
    return patient ? { ok: true, role: 'PATIENT', patient, doctor: null } : { ok: false };
  }
  if (user.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    return doctor ? { ok: true, role: 'DOCTOR', patient: null, doctor } : { ok: false };
  }
  return { ok: false };
}

async function loadAuthorisedConversation(id: string, user: SessionUser): Promise<
  | { ok: true; role: 'PATIENT' | 'DOCTOR'; patient: any; doctor: any; conversation: ConversationRow }
  | { ok: false; status: number; code: string; message: string }
> {
  const conversation = (await db.orm.public.Conversation.where({ id })
    .include('patient', (p: any) => p.include('user'))
    .include('doctor', (d: any) => d.include('user'))
    .first()) as ConversationRow | null;
  if (!conversation) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Conversation not found.' };
  }
  const isPatient = conversation.patient?.userId === user.id;
  const isDoctor = conversation.doctor?.userId === user.id;
  if (!isPatient && !isDoctor) {
    // Return NOT_FOUND rather than FORBIDDEN so non-participants cannot probe ids.
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Conversation not found.' };
  }
  return {
    ok: true,
    role: isPatient ? 'PATIENT' : 'DOCTOR',
    patient: conversation.patient,
    doctor: conversation.doctor,
    conversation,
  };
}

function counterpartOf(conversation: ConversationRow, role: 'PATIENT' | 'DOCTOR') {
  if (role === 'PATIENT') {
    const d = conversation.doctor;
    return { id: conversation.doctorId, name: d?.user?.name ?? 'Doctor', subtitle: d?.specialization ?? null };
  }
  const p = conversation.patient;
  return { id: conversation.patientId, name: p?.user?.name ?? 'Patient', subtitle: null };
}

function viewMessage(m: MessageRow, user: SessionUser, role: 'PATIENT' | 'DOCTOR') {
  return {
    id: m.id,
    body: m.body,
    sender: m.senderId === user.id ? role : role === 'PATIENT' ? 'DOCTOR' : 'PATIENT',
    mine: m.senderId === user.id,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}

async function summarise(conversation: ConversationRow, user: SessionUser, role: 'PATIENT' | 'DOCTOR') {
  const messages = (await db.orm.public.Message.where({ conversationId: conversation.id }).all()) as MessageRow[];
  const sorted = messages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const last = sorted[sorted.length - 1] ?? null;
  const unread = sorted.filter((m) => m.senderId !== user.id && !m.readAt).length;
  return {
    id: conversation.id,
    counterpart: counterpartOf(conversation, role),
    lastMessageAt: conversation.lastMessageAt ?? last?.createdAt ?? null,
    lastMessage: last ? { body: last.body, mine: last.senderId === user.id, createdAt: last.createdAt } : null,
    unread,
    createdAt: conversation.createdAt,
  };
}

router.get('/conversations', async (req, res) => {
  const user = getUser(req);
  const actor = await resolveActor(user);
  if (!actor.ok) return ok(res, { items: [] });

  const rows = actor.role === 'PATIENT'
    ? ((await db.orm.public.Conversation.where({ patientId: actor.patient.id })
        .include('patient', (p: any) => p.include('user'))
        .include('doctor', (d: any) => d.include('user'))
        .all()) as ConversationRow[])
    : ((await db.orm.public.Conversation.where({ doctorId: actor.doctor.id })
        .include('patient', (p: any) => p.include('user'))
        .include('doctor', (d: any) => d.include('user'))
        .all()) as ConversationRow[]);

  const items = await Promise.all(rows.map((c) => summarise(c, user, actor.role)));
  items.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
    return bt - at;
  });
  return ok(res, { items });
});

router.post('/conversations', async (req, res) => {
  const user = getUser(req);
  const actor = await resolveActor(user);
  if (!actor.ok) return fail(res, 'PROFILE_REQUIRED', 'Complete your profile before messaging.', 403);
  const parsed = startConversationSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  let patientId = '';
  let doctorId = '';
  if (actor.role === 'PATIENT') {
    if (!parsed.data.doctorId) return fail(res, 'VALIDATION_ERROR', 'doctorId is required.', 422);
    const doctor = await db.orm.public.Doctor.where({ id: parsed.data.doctorId }).include('user').first();
    if (!doctor) return fail(res, 'DOCTOR_NOT_FOUND', 'Doctor not found.', 404);
    if ((doctor as any).user?.verificationStatus !== 'VERIFIED') {
      return fail(res, 'VERIFICATION_REQUIRED', 'This doctor is not verified yet.', 403);
    }
    patientId = actor.patient.id;
    doctorId = (doctor as any).id;
  } else {
    if (!parsed.data.patientId) return fail(res, 'VALIDATION_ERROR', 'patientId is required.', 422);
    const patient = await db.orm.public.Patient.where({ id: parsed.data.patientId }).first();
    if (!patient) return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
    patientId = (patient as any).id;
    doctorId = actor.doctor.id;
  }

  let conversation = (await db.orm.public.Conversation.where({ patientId, doctorId }).first()) as ConversationRow | null;
  if (!conversation) {
    conversation = (await db.orm.public.Conversation.create({
      patientId,
      doctorId,
      lastMessageAt: null,
    })) as ConversationRow;
  }
  const fresh = (await db.orm.public.Conversation.where({ id: conversation.id })
    .include('patient', (p: any) => p.include('user'))
    .include('doctor', (d: any) => d.include('user'))
    .first()) as ConversationRow;
  return ok(res, await summarise(fresh, user, actor.role), 201);
});

router.get('/conversations/:id/messages', async (req, res) => {
  const user = getUser(req);
  const auth = await loadAuthorisedConversation(req.params.id, user);
  if (!auth.ok) return fail(res, auth.code, auth.message, auth.status);
  const p = parsePage(req.query as Record<string, unknown>, 30, 100);
  const all = (await db.orm.public.Message.where({ conversationId: auth.conversation.id }).all()) as MessageRow[];
  all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const total = all.length;
  const slice = all.slice(Math.max(0, total - p.offset - p.limit), total - p.offset);
  const items = slice.map((m) => viewMessage(m, user, auth.role));
  return ok(res, { items, meta: pageMeta(p, total), counterpart: counterpartOf(auth.conversation, auth.role) });
});

router.post('/conversations/:id/messages', async (req, res) => {
  const user = getUser(req);
  const auth = await loadAuthorisedConversation(req.params.id, user);
  if (!auth.ok) return fail(res, auth.code, auth.message, auth.status);
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const created = (await db.orm.public.Message.create({
    conversationId: auth.conversation.id,
    senderId: user.id,
    body: parsed.data.body,
    readAt: null,
  })) as MessageRow;
  await db.orm.public.Conversation.where({ id: auth.conversation.id }).update({ lastMessageAt: created.createdAt });

  const recipientId = auth.role === 'PATIENT' ? auth.doctor?.userId : auth.patient?.userId;
  if (recipientId) {
    emitToUser(recipientId, 'message', { conversationId: auth.conversation.id });
    await notify(recipientId, {
      type: 'MESSAGE',
      title: 'New secure message',
      body: 'You have a new message in your secure inbox.',
      link: '/messages',
    }).catch(() => undefined);
  }
  return ok(res, viewMessage(created, user, auth.role), 201);
});

router.post('/conversations/:id/read', async (req, res) => {
  const user = getUser(req);
  const auth = await loadAuthorisedConversation(req.params.id, user);
  if (!auth.ok) return fail(res, auth.code, auth.message, auth.status);
  const all = (await db.orm.public.Message.where({ conversationId: auth.conversation.id }).all()) as MessageRow[];
  const unread = all.filter((m) => m.senderId !== user.id && !m.readAt);
  const at = new Date().toISOString();
  await Promise.all(unread.map((m) => db.orm.public.Message.where({ id: m.id }).update({ readAt: at })));
  return ok(res, { read: unread.length });
});

export default router;
