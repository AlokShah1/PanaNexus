import { db } from '../../prisma/db.js';
import { emitToUser } from './realtime.js';

export interface NotifyInput {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

export async function notify(userId: string, input: NotifyInput): Promise<void> {
  try {
    const row = await db.orm.public.Notification.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      read: false,
    });
    emitToUser(userId, 'notification', {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      read: row.read,
      createdAt: row.createdAt,
    });
  } catch (err) {
    console.error('notify failed', err);
  }
}
