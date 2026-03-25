import type { Context, Next } from 'hono';

interface Entry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store.
 *
 * ⚠️  SINGLE-INSTANCE ONLY — if the app scales to multiple instances (e.g.
 *     Render auto-scaling) this store is NOT shared across processes.
 *     To support multi-instance, replace with a Redis-backed implementation:
 *       - upstash/ratelimit (serverless-friendly, works on Render)
 *       - ioredis sliding-window counter
 *     The rateLimit() middleware API does not need to change — just swap the store.
 */
const store = new Map<string, Entry>();

// Periodically clear expired entries to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

/**
 * Clear all rate limit counters. Useful in development and integration tests
 * when the backend is not restarted between test runs.
 */
export function clearRateLimitStore() {
  store.clear();
}

/**
 * Simple in-memory sliding-window rate limiter.
 * @param max   Max requests per window
 * @param window  Window duration in milliseconds
 */
export function rateLimit(max: number, window: number) {
  return async (c: Context, next: Next) => {
    // Prefer cf-connecting-ip (set by Cloudflare, trusted) over x-forwarded-for.
    // For x-forwarded-for, take the LAST entry (closest proxy / most likely real client
    // when behind a single trusted reverse proxy) to reduce spoofing risk.
    const xff = c.req.header('x-forwarded-for');
    const xffIp = xff ? xff.split(',').pop()!.trim() : undefined;
    const ip =
      c.req.header('cf-connecting-ip') ??
      xffIp ??
      'unknown';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + window });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ success: false, error: 'คำขอมากเกินไป กรุณารอสักครู่' }, 429);
    }

    return next();
  };
}
