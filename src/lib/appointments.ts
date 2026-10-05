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
