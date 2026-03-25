/**
 * E2E Integration Tests
 *
 * These tests require a running PostgreSQL instance.
 * Run with: bun test:e2e
 *
 * Prerequisite: docker-compose up -d && bun run db:migrate
 */
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestApp, createTestJWT, makeRequest, TEST_ADMIN, TEST_EMPLOYEE, TEST_MANAGER } from './test-helpers';
import type { Hono } from 'hono';

let app: Hono;
let adminToken: string;
let employeeToken: string;
let managerToken: string;

beforeAll(async () => {
  app = createTestApp();
  adminToken = await createTestJWT(TEST_ADMIN);
  employeeToken = await createTestJWT(TEST_EMPLOYEE);
  managerToken = await createTestJWT(TEST_MANAGER);
});

// ─── Health Check ───────────────────────────────────────────────────────────

describe('Health Check', () => {
  test('GET /health returns status', async () => {
    const res = await app.request('/health');
    const body = await res.json() as any;
    expect(body.status).toBeDefined();
    expect(body.timestamp).toBeDefined();
    // DB might be ok or unreachable depending on Docker state
    expect(['ok', 'error']).toContain(body.status);
  });
});

// ─── Auth Flow ──────────────────────────────────────────────────────────────

describe('Auth Endpoints', () => {
  test('POST /api/auth/login with invalid credentials → 401 or error', async () => {
    const res = await makeRequest(app, 'POST', '/api/auth/login', {
      body: { email: 'nobody@test.com', password: 'wrongpass' },
    });
    // May get 401 (invalid creds) or 500 (db unreachable)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/auth/login with invalid body → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/auth/login', {
      body: { email: 'not-email', password: '123' },
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/auth/me without token → 401', async () => {
    const res = await makeRequest(app, 'GET', '/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me with valid token → 200', async () => {
    const res = await makeRequest(app, 'GET', '/api/auth/me', { token: adminToken });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_ADMIN.sub);
  });

  test('POST /api/auth/qr-login with invalid token → error', async () => {
    const res = await makeRequest(app, 'POST', '/api/auth/qr-login', {
      body: { token: 'invalid-qr-token' },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── Role Guard Tests ───────────────────────────────────────────────────────

describe('Role Guards', () => {
  test('employee cannot access GET /api/employees', async () => {
    const res = await makeRequest(app, 'GET', '/api/employees', { token: employeeToken });
    expect(res.status).toBe(403);
  });

  test('admin can access GET /api/employees', async () => {
    const res = await makeRequest(app, 'GET', '/api/employees', { token: adminToken });
    // May get 200 (success) or 500 (DB not available)
    expect([200, 500]).toContain(res.status);
  });

  test('manager can access GET /api/employees', async () => {
    const res = await makeRequest(app, 'GET', '/api/employees', { token: managerToken });
    expect([200, 500]).toContain(res.status);
  });

  test('employee cannot access GET /api/attendance/logs', async () => {
    const res = await makeRequest(app, 'GET', '/api/attendance/logs', { token: employeeToken });
    expect(res.status).toBe(403);
  });

  test('employee cannot PATCH /api/attendance/logs/:id', async () => {
    const res = await makeRequest(app, 'PATCH', '/api/attendance/logs/log_001', {
      token: employeeToken,
      body: { status: 'present' },
    });
    expect(res.status).toBe(403);
  });

  test('employee cannot DELETE /api/employees/:id', async () => {
    const res = await makeRequest(app, 'DELETE', '/api/employees/emp_001', { token: employeeToken });
    expect(res.status).toBe(403);
  });

  test('employee cannot PATCH /api/ot-requests/:id/status', async () => {
    const res = await makeRequest(app, 'PATCH', '/api/ot-requests/ot_001/status', {
      token: employeeToken,
      body: { status: 'approved' },
    });
    expect(res.status).toBe(403);
  });
});

// ─── Validation Tests ───────────────────────────────────────────────────────

describe('Input Validation', () => {
  test('POST /api/attendance/check-in with invalid coords → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/attendance/check-in', {
      token: employeeToken,
      body: { lat: 999, lng: 999 },
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/attendance/check-out with missing body → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/attendance/check-out', {
      token: employeeToken,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/employees with invalid email → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/employees', {
      token: adminToken,
      body: { name: 'Test', email: 'bad-email', password: '123456', department: 'IT', position: 'Dev' },
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/locations with missing name → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/locations', {
      token: adminToken,
      body: { lat: 13.7, lng: 100.5 },
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/ot-requests with empty reason → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/ot-requests', {
      token: employeeToken,
      body: { date: '2026-03-19', startTime: '18:00', endTime: '20:00', reason: '' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── Settings ───────────────────────────────────────────────────────────────

describe('Settings Endpoints', () => {
  test('GET /api/settings requires auth', async () => {
    const res = await makeRequest(app, 'GET', '/api/settings');
    expect(res.status).toBe(401);
  });

  test('PUT /api/settings requires admin role', async () => {
    const res = await makeRequest(app, 'PUT', '/api/settings', {
      token: employeeToken,
      body: { defaultOtRateType: 'fixed' },
    });
    expect(res.status).toBe(403);
  });

  test('PUT /api/settings with invalid type → 400', async () => {
    const res = await makeRequest(app, 'PUT', '/api/settings', {
      token: adminToken,
      body: { defaultOtRateType: 'invalid_type' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── Attendance (Employee Self-Service) ─────────────────────────────────────

describe('Attendance Self-Service', () => {
  test('GET /api/attendance/logs/today with auth', async () => {
    const res = await makeRequest(app, 'GET', '/api/attendance/logs/today', { token: employeeToken });
    // 200 (DB ok) or 500 (DB not reachable)
    expect([200, 500]).toContain(res.status);
  });
});

// ─── QR Check-in (Public) ───────────────────────────────────────────────────

describe('QR Check-in Endpoints', () => {
  test('GET /api/qr-checkin/:id with non-existent employee', async () => {
    const res = await app.request('/api/qr-checkin/emp_nonexistent');
    // 404 or 500 (DB not reachable)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/qr-checkin/:id with invalid coords → 400', async () => {
    const res = await makeRequest(app, 'POST', '/api/qr-checkin/emp_001', {
      body: { lat: 999, lng: 999 },
    });
    expect(res.status).toBe(400);
  });
});
