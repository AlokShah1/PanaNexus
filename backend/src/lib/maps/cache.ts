interface Entry {
  value: unknown;
  expires: number;
}

/** Minimal in-memory TTL cache used to keep external map providers under their rate limits. */
export class TtlCache {
  private store = new Map<string, Entry>();

  constructor(private readonly ttlMs: number) {}

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.ttlMs <= 0) return load();
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expires > now) return hit.value as T;
    const value = await load();
    this.store.set(key, { value, expires: now + this.ttlMs });
    return value;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
