export type CacheDomainKey =
  'marketplace' | 'workspace' | 'appointments' | 'finance' | 'loyalty' | 'notifications';

export const DEFAULT_DOMAIN_TTL_MS: Record<CacheDomainKey, number> = {
  marketplace: 60_000,
  workspace: 30_000,
  appointments: 20_000,
  finance: 20_000,
  loyalty: 30_000,
  notifications: 15_000,
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  updatedAt: number;
}

export interface DomainCacheStats {
  hits: number;
  misses: number;
  coalesced: number;
  invalidations: number;
  entries: number;
}

export class DomainCache {
  private entries = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private stats: Omit<DomainCacheStats, 'entries'> = {
    hits: 0,
    misses: 0,
    coalesced: 0,
    invalidations: 0,
  };

  private keyFor(salonId: string, domain: CacheDomainKey, qualifier?: string): string {
    return qualifier ? `${salonId}:${domain}:${qualifier}` : `${salonId}:${domain}`;
  }

  peek<T>(salonId: string, domain: CacheDomainKey, qualifier?: string, now = Date.now()): T | undefined {
    const key = this.keyFor(salonId, domain, qualifier);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(
    salonId: string,
    domain: CacheDomainKey,
    value: T,
    ttlMs = DEFAULT_DOMAIN_TTL_MS[domain],
    qualifier?: string,
    now = Date.now(),
  ): void {
    const key = this.keyFor(salonId, domain, qualifier);
    this.entries.set(key, {
      value,
      updatedAt: now,
      expiresAt: now + Math.max(0, ttlMs),
    });
  }

  async getOrLoad<T>(
    salonId: string,
    domain: CacheDomainKey,
    fetcher: () => Promise<T>,
    options: { ttlMs?: number; force?: boolean; qualifier?: string; now?: number } = {},
  ): Promise<T> {
    const now = options.now ?? Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_DOMAIN_TTL_MS[domain];
    const key = this.keyFor(salonId, domain, options.qualifier);

    if (!options.force) {
      const cached = this.peek<T>(salonId, domain, options.qualifier, now);
      if (cached !== undefined) {
        this.stats.hits += 1;
        return cached;
      }

      const pending = this.inflight.get(key);
      if (pending) {
        this.stats.coalesced += 1;
        return pending as Promise<T>;
      }
    }

    this.stats.misses += 1;
    const promise = fetcher()
      .then((value) => {
        this.set(salonId, domain, value, ttlMs, options.qualifier, Date.now());
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key);
        }
      });

    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(salonId: string, domain: CacheDomainKey, qualifier?: string): void {
    const prefix = qualifier ? `${salonId}:${domain}:${qualifier}` : `${salonId}:${domain}`;
    let removed = false;
    for (const key of this.entries.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.entries.delete(key);
        removed = true;
      }
    }
    for (const key of this.inflight.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.inflight.delete(key);
      }
    }
    if (removed) {
      this.stats.invalidations += 1;
    }
  }

  invalidateSalon(salonId: string): void {
    const prefix = `${salonId}:`;
    let removed = false;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        removed = true;
      }
    }
    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) {
        this.inflight.delete(key);
      }
    }
    if (removed) {
      this.stats.invalidations += 1;
    }
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  getStats(): DomainCacheStats {
    return {
      ...this.stats,
      entries: this.entries.size,
    };
  }
}

export function createDomainCache(): DomainCache {
  return new DomainCache();
}
