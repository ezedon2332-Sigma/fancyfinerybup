import "server-only";

import Redis from "ioredis";

/**
 * Cache for hot read paths.
 *
 * **Fails open, always.** Every function here swallows its own errors and falls
 * through to the loader. A cache that can take the storefront down is worse
 * than no cache, and the data behind it is all derived — the catalogue, the
 * pricing table, the exchange rates — so a miss is only ever slower, never
 * wrong. `REDIS_URL` being unset is a supported configuration: the app then
 * runs exactly as it did before, straight to Postgres.
 *
 * What is cached is deliberately narrow: configuration and catalogue reads that
 * every visitor triggers and only an admin changes. Nothing user-scoped is
 * cached — an order or a profile keyed by user id would be one prefix bug away
 * from serving one customer's data to another, and the read is already a
 * single indexed lookup.
 */

const globalForCache = globalThis as unknown as { __fancyRedis?: Redis | null };

function client(): Redis | null {
  if (globalForCache.__fancyRedis !== undefined) return globalForCache.__fancyRedis;

  const url = process.env.REDIS_URL;
  if (!url) {
    globalForCache.__fancyRedis = null;
    return null;
  }

  const redis = new Redis(url, {
    // Fail fast and fall through to Postgres rather than queueing a request
    // behind a cache that is not answering.
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  // Without a handler, a connection error is an unhandled 'error' event and
  // takes the Node process down — the cache killing the app it exists to speed
  // up. Logged once per event and otherwise ignored.
  redis.on("error", (e) => {
    console.warn("[cache] redis unavailable:", e.message);
  });

  globalForCache.__fancyRedis = redis;
  return redis;
}

/** Namespaced so a shared Redis cannot collide with another app. */
function key(k: string): string {
  return `ff:${k}`;
}

/**
 * Read-through cache.
 *
 * `ttlSeconds` is the ceiling on staleness for anything the explicit
 * invalidation below misses. Admin writes call `invalidate`, so the TTL is a
 * backstop rather than the mechanism.
 */
export async function cached<T>(
  k: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const redis = client();
  if (!redis) return load();

  try {
    const hit = await redis.get(key(k));
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Unreachable or malformed — fall through and load.
  }

  const value = await load();

  try {
    await redis.set(key(k), JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // A failed write must not fail the request that produced the value.
  }

  return value;
}

/** Drop specific keys after an admin write. */
export async function invalidate(...keys: string[]): Promise<void> {
  const redis = client();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys.map(key));
  } catch {
    // Worst case the TTL expires it.
  }
}

/**
 * The cache keys, in one place.
 *
 * Named rather than spelled out at each call site: a typo'd key is a permanent
 * silent miss, which looks exactly like a cache that is working and is never
 * noticed.
 */
export const CACHE_KEYS = {
  pricingTable: "pricing-table",
  exchangeRates: "exchange-rates",
  aiConfig: "ai-config",
  countryRates: "country-rates",
  categories: "categories",
} as const;

/** TTLs, in seconds. */
export const TTL = {
  /** Rates and tax: changed rarely, and every checkout reads them. */
  pricing: 300,
  /** Configuration read on every page render. */
  config: 300,
  /** The published rate card — expensive to build, changes with the rates. */
  rateCard: 600,
} as const;
