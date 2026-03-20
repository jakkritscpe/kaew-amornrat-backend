import { describe, expect, test, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { rateLimit } from './rate-limit';

describe('rateLimit', () => {
  function createApp(max: number, windowMs: number) {
    const app = new Hono();
    app.use('*', rateLimit(max, windowMs));
    app.get('/test', (c) => c.json({ ok: true }));
    return app;
  }

  test('allows requests under limit', async () => {
    const app = createApp(3, 60_000);
    // Use a unique IP for this test
    const headers = { 'X-Forwarded-For': 'test-ip-under-limit' };

    const res1 = await app.request('/test', { headers });
    expect(res1.status).toBe(200);

    const res2 = await app.request('/test', { headers });
    expect(res2.status).toBe(200);

    const res3 = await app.request('/test', { headers });
    expect(res3.status).toBe(200);
  });

  test('blocks requests over limit with 429', async () => {
    const app = createApp(2, 60_000);
    const headers = { 'X-Forwarded-For': 'test-ip-over-limit' };

    await app.request('/test', { headers }); // 1
    await app.request('/test', { headers }); // 2
    const res = await app.request('/test', { headers }); // 3 → blocked

    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toContain('คำขอมากเกินไป');
  });

  test('includes Retry-After header on 429', async () => {
    const app = createApp(1, 60_000);
    const headers = { 'X-Forwarded-For': 'test-ip-retry-after' };

    await app.request('/test', { headers }); // 1
    const res = await app.request('/test', { headers }); // 2 → blocked

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  test('different IPs have separate limits', async () => {
    const app = createApp(1, 60_000);

    const res1 = await app.request('/test', { headers: { 'X-Forwarded-For': 'ip-a' } });
    expect(res1.status).toBe(200);

    const res2 = await app.request('/test', { headers: { 'X-Forwarded-For': 'ip-b' } });
    expect(res2.status).toBe(200);
  });

  test('uses cf-connecting-ip as fallback', async () => {
    const app = createApp(1, 60_000);
    const headers = { 'cf-connecting-ip': 'cf-test-ip' };

    const res1 = await app.request('/test', { headers });
    expect(res1.status).toBe(200);

    const res2 = await app.request('/test', { headers });
    expect(res2.status).toBe(429);
  });
});
