export type Schedule = { always: true } | { always: false; days: number[]; openMin: number; closeMin: number };
export type NowIST = { day: number; minutes: number };

const DAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Parses the facility operating-hours formats used in the product:
 *   "Open 24 hours" | "Mon–Sat 08:00–20:00" | "Mon–Fri 09:00–17:00"
 * Returns null for unknown formats (treated as "hours not listed").
 */
export function parseHours(raw: string | null | undefined): Schedule | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^open\s+24\s+hours$/i.test(t)) return { always: true };
  const m = t.match(/^([A-Za-z]{3})\s*[–-]\s*([A-Za-z]{3})\s+(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const from = DAY[m[1].slice(0, 3)];
  const to = DAY[m[2].slice(0, 3)];
  if (from == null || to == null) return null;
  const days: number[] = [];
  let d = from;
  for (let i = 0; i < 7; i++) {
    days.push(d);
    if (d === to) break;
    d = (d + 1) % 7;
  }
  return {
    always: false,
    days,
    openMin: Number(m[3]) * 60 + Number(m[4]),
    closeMin: Number(m[5]) * 60 + Number(m[6]),
  };
}

/** Current time in Asia/Kolkata (facilities are Indian). */
export function nowIST(date: Date = new Date()): NowIST {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const day = DAY[parts.weekday] ?? 0;
  const hour = Number(parts.hour) % 24;
  return { day, minutes: hour * 60 + Number(parts.minute) };
}

/** true/false when knowable, null when hours are missing or unparseable. */
export function isOpenNow(raw: string | null | undefined, now: NowIST = nowIST()): boolean | null {
  const s = parseHours(raw);
  if (!s) return null;
  if (s.always) return true;
  if (!s.days.includes(now.day)) return false;
  if (s.closeMin <= s.openMin) return now.minutes >= s.openMin || now.minutes < s.closeMin;
  return now.minutes >= s.openMin && now.minutes < s.closeMin;
}
