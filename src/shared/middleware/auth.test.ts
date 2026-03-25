import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { verifyJWT, authMiddleware, guardRole } from './auth';

// ─── Helper to create a real JWT for testing ────────────────────────────────

const TEST_SECRET = 'test-secret-key-that-is-long-enough-for-hmac-sha256';

async function createTestJWT(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
  expiresIn = 3600
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64url = (obj: unknown) => {
    const json = JSON.stringify(obj);
    return Buffer.from(json).toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const message = `${b64url(header)}.${b64url(claims)}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${message}.${sigB64}`;
}

// ─── verifyJWT Tests ────────────────────────────────────────────────────────

describe('verifyJWT', () => {
  test('valid token returns payload', async () => {
    const token = await createTestJWT({ sub: 'emp_001', role: 'admin', name: 'Test', email: 'test@test.com' });
    const payload = await verifyJWT(token, TEST_SECRET);
    expect(payload.sub).toBe('emp_001');
    expect(payload.role).toBe('admin');
  });

  test('invalid signature throws', async () => {
    const token = await createTestJWT({ sub: 'emp_001' });
    try {
      await verifyJWT(token, 'wrong-secret-wrong-secret-wrong-secret');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toBe('Invalid signature');
    }
  });

  test('malformed token throws', async () => {
    try {
      await verifyJWT('not.a.valid.jwt.with.five.parts', TEST_SECRET);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toBe('Invalid token format');
    }
  });

  test('expired token throws', async () => {
    const token = await createTestJWT({ sub: 'emp_001' }, TEST_SECRET, -3600); // expired 1h ago
    try {
      await verifyJWT(token, TEST_SECRET);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toBe('Token expired');
    }
  });
});

// ─── authMiddleware Tests ───────────────────────────────────────────────────

describe('authMiddleware', () => {
  function createApp() {
    const app = new Hono();
    // Set JWT_SECRET for middleware
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;

    app.use('*', authMiddleware);
    app.get('/test', (c) => {
      const payload = c.get('jwtPayload') as any;
      return c.json({ sub: payload.sub });
    });

    return { app, cleanup: () => { process.env.JWT_SECRET = originalSecret; } };
  }

  test('401 without Authorization header', async () => {
    const { app, cleanup } = createApp();
    try {
      const res = await app.request('/test');
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('401 without Bearer prefix', async () => {
    const { app, cleanup } = createApp();
    try {
      const res = await app.request('/test', {
        headers: { Authorization: 'Basic abc123' },
      });
      expect(res.status).toBe(401);
    } finally {
      cleanup();
    }
  });

  test('401 with invalid token', async () => {
    const { app, cleanup } = createApp();
    try {
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status).toBe(401);
    } finally {
      cleanup();
    }
  });

  test('200 with valid token — sets jwtPayload', async () => {
    const { app, cleanup } = createApp();
    try {
      const token = await createTestJWT({
        sub: 'emp_admin', name: 'Test', email: 'test@test.com', role: 'admin',
      });
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.sub).toBe('emp_admin');
    } finally {
      cleanup();
    }
  });
});

// ─── guardRole Tests ────────────────────────────────────────────────────────

describe('guardRole', () => {
  function createApp(roles: Array<'admin' | 'manager' | 'employee'>) {
    const app = new Hono();
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;

    app.use('*', authMiddleware);
    app.get('/test', guardRole(...roles), (c) => c.json({ ok: true }));

    return { app, cleanup: () => { process.env.JWT_SECRET = originalSecret; } };
  }

  test('403 when role not in allowed list', async () => {
    // Use emp_admin as sub (active employee) but put 'employee' role in JWT payload
    // guardRole checks payload.role, not the DB role — so this correctly tests 403
    const { app, cleanup } = createApp(['admin']);
    try {
      const token = await createTestJWT({
        sub: 'emp_admin', name: 'Test', email: 'test@test.com', role: 'employee',
      });
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    } finally {
      cleanup();
    }
  });

  test('200 when role matches', async () => {
    const { app, cleanup } = createApp(['admin', 'manager']);
    try {
      const token = await createTestJWT({
        sub: 'emp_admin', name: 'Test', email: 'test@test.com', role: 'admin',
      });
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    } finally {
      cleanup();
    }
  });

  test('200 for manager when manager is allowed', async () => {
    const { app, cleanup } = createApp(['admin', 'manager']);
    try {
      const token = await createTestJWT({
        sub: 'emp_admin', name: 'Manager', email: 'mgr@test.com', role: 'manager',
      });
      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    } finally {
      cleanup();
    }
  });
});
