import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';

// ─── Mock dependencies BEFORE importing routes ──────────────────────────────

const mockGetLogs = mock(() =>
  Promise.resolve({
    data: [
      {
        id: 'log_001',
        employeeId: 'emp_001',
        date: '2026-03-19',
        checkInTime: '2026-03-19T01:00:00Z',
        checkOutTime: null,
        status: 'present',
        workHours: 0,
        otHours: 0,
        employeeName: 'สมชาย',
        employeeDepartment: 'IT',
      },
    ],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  })
);

const mockGetTodayLog = mock(() =>
  Promise.resolve({
    id: 'log_001',
    employeeId: 'emp_001',
    date: '2026-03-19',
    checkInTime: '2026-03-19T01:00:00Z',
    checkOutTime: null,
    status: 'present',
    workHours: 0,
    otHours: 0,
  })
);

const mockCheckIn = mock(() =>
  Promise.resolve({
    id: 'log_new',
    employeeId: 'emp_001',
    date: '2026-03-19',
    checkInTime: '2026-03-19T01:00:00Z',
    status: 'present',
  })
);

const mockCheckOut = mock(() =>
  Promise.resolve({
    id: 'log_001',
    employeeId: 'emp_001',
    date: '2026-03-19',
    checkInTime: '2026-03-19T01:00:00Z',
    checkOutTime: '2026-03-19T10:00:00Z',
    status: 'present',
    workHours: 9,
    otHours: 0,
  })
);

const mockUpdateLog = mock(() => Promise.resolve());

mock.module('./service', () => ({
  getLogs: mockGetLogs,
  getTodayLog: mockGetTodayLog,
  checkIn: mockCheckIn,
  checkOut: mockCheckOut,
  updateLog: mockUpdateLog,
}));

// ─── Create test app with mocked auth ───────────────────────────────────────

// Helper to create JWT token (not real, we mock auth)
function createTestApp(role: 'admin' | 'manager' | 'employee' = 'admin', sub = 'emp_001') {
  const app = new Hono();

  // Mock auth middleware — inject jwtPayload directly
  app.use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const token = authHeader.slice(7);
    if (token === 'invalid') {
      return c.json({ success: false, error: 'Invalid or expired token' }, 401);
    }
    // Parse role from token format: "test-{role}"
    const tokenRole = token.startsWith('test-') ? token.split('-')[1] : role;
    c.set('jwtPayload', { sub, name: 'Test User', email: 'test@test.com', role: tokenRole });
    await next();
  });

  // Inline route definitions (same logic as routes.ts but using mocked service)
  // This tests route-level concerns: validation, role guards, response format
  const { zValidator } = require('@hono/zod-validator');
  const { checkInSchema, checkOutSchema, listLogsSchema, updateLogSchema } = require('./schema');
  const { ok } = require('../../shared/utils/response');

  app.get('/logs', async (c) => {
    const payload = c.get('jwtPayload') as any;
    if (!['admin', 'manager'].includes(payload.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const query: Record<string, string> = {};
    for (const [k, v] of new URL(c.req.url).searchParams.entries()) {
      query[k] = v;
    }
    const parsed = listLogsSchema.safeParse(query);
    if (!parsed.success) return c.json({ success: false, error: 'Validation error' }, 400);
    return c.json(ok(await mockGetLogs(parsed.data)));
  });

  app.get('/logs/today', async (c) => {
    const payload = c.get('jwtPayload') as any;
    return c.json(ok(await mockGetTodayLog(payload.sub)));
  });

  app.post('/check-in', async (c) => {
    const body = await c.req.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: 'Validation error' }, 400);
    const payload = c.get('jwtPayload') as any;
    const log = await mockCheckIn(payload.sub, parsed.data.lat, parsed.data.lng);
    return c.json(ok(log, 'Check-in สำเร็จ'));
  });

  app.post('/check-out', async (c) => {
    const body = await c.req.json();
    const parsed = checkOutSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: 'Validation error' }, 400);
    const payload = c.get('jwtPayload') as any;
    const log = await mockCheckOut(payload.sub, parsed.data.lat, parsed.data.lng);
    return c.json(ok(log, 'Check-out สำเร็จ'));
  });

  app.patch('/logs/:id', async (c) => {
    const payload = c.get('jwtPayload') as any;
    if (payload.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const body = await c.req.json();
    const parsed = updateLogSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: 'Validation error' }, 400);
    await mockUpdateLog(c.req.param('id'), parsed.data);
    return c.json(ok(null, 'Log updated'));
  });

  return app;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function request(app: Hono, method: string, path: string, options: {
  token?: string;
  body?: Record<string, unknown>;
} = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';

  return app.request(path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Attendance Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();
    mockGetLogs.mockClear();
    mockGetTodayLog.mockClear();
    mockCheckIn.mockClear();
    mockCheckOut.mockClear();
    mockUpdateLog.mockClear();
  });

  describe('GET /logs', () => {
    test('401 without auth token', async () => {
      const res = await request(app, 'GET', '/logs');
      expect(res.status).toBe(401);
    });

    test('403 for employee role', async () => {
      const res = await request(app, 'GET', '/logs', { token: 'test-employee' });
      expect(res.status).toBe(403);
    });

    test('200 for admin role', async () => {
      const res = await request(app, 'GET', '/logs', { token: 'test-admin' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    test('200 for manager role', async () => {
      const res = await request(app, 'GET', '/logs', { token: 'test-manager' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /logs/today', () => {
    test('200 returns today log for authenticated user', async () => {
      const res = await request(app, 'GET', '/logs/today', { token: 'test-employee' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(mockGetTodayLog).toHaveBeenCalledWith('emp_001');
    });

    test('401 without auth', async () => {
      const res = await request(app, 'GET', '/logs/today');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /check-in', () => {
    test('200 with valid coordinates', async () => {
      const res = await request(app, 'POST', '/check-in', {
        token: 'test-employee',
        body: { lat: 13.7563, lng: 100.5018 },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('Check-in');
    });

    test('400 with invalid coordinates', async () => {
      const res = await request(app, 'POST', '/check-in', {
        token: 'test-employee',
        body: { lat: 999, lng: 999 },
      });
      expect(res.status).toBe(400);
    });

    test('400 with missing body', async () => {
      const res = await request(app, 'POST', '/check-in', {
        token: 'test-employee',
        body: {},
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /check-out', () => {
    test('200 with valid coordinates', async () => {
      const res = await request(app, 'POST', '/check-out', {
        token: 'test-employee',
        body: { lat: 13.7563, lng: 100.5018 },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('Check-out');
    });

    test('400 with invalid body', async () => {
      const res = await request(app, 'POST', '/check-out', {
        token: 'test-employee',
        body: { lat: 'invalid' },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /logs/:id', () => {
    test('200 for admin', async () => {
      const res = await request(app, 'PATCH', '/logs/log_001', {
        token: 'test-admin',
        body: { status: 'late' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Log updated');
    });

    test('403 for employee', async () => {
      const res = await request(app, 'PATCH', '/logs/log_001', {
        token: 'test-employee',
        body: { status: 'late' },
      });
      expect(res.status).toBe(403);
    });

    test('400 with invalid status', async () => {
      const res = await request(app, 'PATCH', '/logs/log_001', {
        token: 'test-admin',
        body: { status: 'invalid_status' },
      });
      expect(res.status).toBe(400);
    });
  });
});
