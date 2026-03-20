/**
 * E2E Test Helpers
 *
 * Utilities for end-to-end tests that require a real PostgreSQL database.
 * The database must be running (e.g., via docker-compose).
 */

import { createApp } from '../app';
import type { Hono } from 'hono';

export const E2E_JWT_SECRET = 'e2e-test-secret-key-that-is-long-enough-for-hmac-sha256-validation';

/**
 * Create a real JWT token for E2E testing.
 */
export async function createTestJWT(
  payload: { sub: string; name: string; email: string; role: 'admin' | 'manager' | 'employee' },
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
    'raw', new TextEncoder().encode(E2E_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${message}.${sigB64}`;
}

/**
 * Create an E2E test app instance with required env vars set.
 */
export function createTestApp() {
  process.env.JWT_SECRET = E2E_JWT_SECRET;
  process.env.NODE_ENV = 'test';
  return createApp() as any as Hono;
}

/**
 * Helper to make requests to the test app.
 */
export function makeRequest(app: Hono, method: string, path: string, options: {
  token?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
} = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';

  let url = path;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url = `${path}?${params.toString()}`;
  }

  return app.request(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Test data constants
 */
export const TEST_ADMIN = {
  sub: 'emp_admin',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin' as const,
};

export const TEST_EMPLOYEE = {
  sub: 'emp_001',
  name: 'Employee User',
  email: 'employee@test.com',
  role: 'employee' as const,
};

export const TEST_MANAGER = {
  sub: 'emp_mgr',
  name: 'Manager User',
  email: 'manager@test.com',
  role: 'manager' as const,
};
