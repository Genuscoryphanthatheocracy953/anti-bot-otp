import { vi } from 'vitest';

export function createMockRedis() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const sortedSets = new Map<string, Map<string, number>>();
  const ttls = new Map<string, number>();

  const mock = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      // Handle NX flag
      const hasNX = args.includes('NX');
      if (hasNX && store.has(key)) return null;

      store.set(key, value);

      // Handle EX TTL
      const exIdx = args.indexOf('EX');
      if (exIdx !== -1) {
        ttls.set(key, args[exIdx + 1] as number);
      }

      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    ttl: vi.fn(async (key: string) => {
      if (!store.has(key)) return -2;
      return ttls.get(key) ?? -1;
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    incr: vi.fn(async (key: string) => {
      const val = parseInt(store.get(key) || '0', 10) + 1;
      store.set(key, val.toString());
      return val;
    }),
    expire: vi.fn(async (_key: string, _seconds: number) => 1),
    // Sorted sets
    zadd: vi.fn(async (key: string, score: string, member: string) => {
      if (!sortedSets.has(key)) sortedSets.set(key, new Map());
      sortedSets.get(key)!.set(member, parseFloat(score));
      return 1;
    }),
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const ss = sortedSets.get(key);
      if (!ss) return 0;
      let removed = 0;
      for (const [member, score] of ss) {
        if (score >= min && score <= max) {
          ss.delete(member);
          removed++;
        }
      }
      return removed;
    }),
    zcard: vi.fn(async (key: string) => {
      return sortedSets.get(key)?.size ?? 0;
    }),
    // Sets
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      if (!sets.has(key)) sets.set(key, new Set());
      let added = 0;
      for (const m of members) {
        if (!sets.get(key)!.has(m)) {
          sets.get(key)!.add(m);
          added++;
        }
      }
      return added;
    }),
    scard: vi.fn(async (key: string) => {
      return sets.get(key)?.size ?? 0;
    }),
    eval: vi.fn(async () => [1, 0]), // Default: allowed, 0 retryAfter
    ping: vi.fn(async () => 'PONG'),
    quit: vi.fn(async () => 'OK'),
    // Internal helpers for testing
    _store: store,
    _sets: sets,
    _sortedSets: sortedSets,
    _ttls: ttls,
    _reset: () => {
      store.clear();
      sets.clear();
      sortedSets.clear();
      ttls.clear();
    },
  };

  return mock;
}

export type MockRedis = ReturnType<typeof createMockRedis>;
