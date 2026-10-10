export const MAX_MESSAGE_LENGTH = 2000;

export type MessageSender = 'PATIENT' | 'DOCTOR';

export type ConversationSummary = {
  id: string;
  counterpart: { id: string; name: string; subtitle?: string | null };
  lastMessageAt: string | null;
  lastMessage: { body: string; createdAt: string } | null;
  unread: number;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  body: string;
  sender: MessageSender;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
};

export type ProviderOption = { id: string; name: string; specialization?: string | null };

export function truncateBody(body: string, max = 80): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
