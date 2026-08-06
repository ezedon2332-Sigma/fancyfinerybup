/**
 * Minimal in-memory fixed-window rate limiter for the chat route.
 *
 * Per-instance only (serverless spreads traffic across instances), so it's a
 * courtesy brake against a single abusive client, not a hard quota. For a hard
 * global limit, back this with Redis/Upstash — the interface stays the same.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}
