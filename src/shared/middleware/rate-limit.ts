import type { Context, Next } from 'hono';

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Periodically clear expired entries to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

/**
 * Simple in-memory sliding-window rate limiter.
 * @param max   Max requests per window
 * @param window  Window duration in milliseconds
 */
export function rateLimit(max: number, window: number) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('cf-connecting-ip') ??
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
