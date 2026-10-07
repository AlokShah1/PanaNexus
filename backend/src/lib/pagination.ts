export interface PageParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parsePage(query: Record<string, unknown>, defaultLimit = 20, maxLimit = 100): PageParams {
  const page = toInt(query.page, 1);
  const limit = Math.min(toInt(query.limit, defaultLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

export function pageMeta(p: PageParams, total: number): PageMeta {
  return { page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) };
}
