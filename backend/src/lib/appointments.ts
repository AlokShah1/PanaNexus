export function slotTaken(
  existing: { startsAt: string; status: string }[],
  requestedStartsAt: string,
): boolean {
  const t = new Date(requestedStartsAt).getTime();
  if (Number.isNaN(t)) return true;
  return existing.some(
    (e) =>
      (e.status === 'REQUESTED' || e.status === 'CONFIRMED') &&
      new Date(e.startsAt).getTime() === t,
  );
}

/**
 * Detects a PostgreSQL unique-constraint violation (SQLSTATE 23505), which is
 * how the partial unique index on active appointment slots surfaces a race
 * between two concurrent bookings.
 */
export function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  const stack: unknown[] = [err];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const record = current as Record<string, unknown>;
    const code = record.code ?? record.sqlState;
    if (code === '23505' || code === 'P2002') return true;
    if (typeof record.message === 'string' && /duplicate key|unique constraint/i.test(record.message)) {
      return true;
    }
    if (record.cause) stack.push(record.cause);
    if (record.originalError) stack.push(record.originalError);
  }
  return false;
}
