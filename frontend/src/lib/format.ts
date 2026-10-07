export function roleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

export function formatDateTime(iso: string, opts?: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
      ...opts,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeZone: 'Asia/Kolkata',
      ...opts,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function relativeTime(iso: string) {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}
