import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../../db';
import { employees } from '../../db/schema';
import { fail } from '../utils/response';
import type { JWTPayload } from '../types';

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, bodyB64, sigB64] = parts;
  const message = `${headerB64}.${bodyB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(message));
  if (!valid) throw new Error('Invalid signature');

  const payload = JSON.parse(
    Buffer.from(bodyB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  ) as JWTPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

export async function authMiddleware(c: Context, next: Next) {
  // Prefer HttpOnly cookie (XSS-safe); fall back to Authorization header for backward-compat
  const cookieToken = getCookie(c, 'auth_token');
  const authorization = c.req.header('Authorization');
  const token = cookieToken ?? (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!token) {
    return c.json(fail('Unauthorized'), 401);
  }
  try {
    const payload = await verifyJWT(token, process.env.JWT_SECRET!);
    const [active] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, payload.sub), isNull(employees.deletedAt)))
      .limit(1);
    if (!active) return c.json(fail('บัญชีนี้ถูกปิดใช้งาน'), 401);
    c.set('jwtPayload', payload);
    await next();
  } catch {
    return c.json(fail('Invalid or expired token'), 401);
  }
}

export function guardRole(...roles: Array<'admin' | 'manager' | 'employee'>) {
  return async (c: Context, next: Next) => {
    const payload = c.get('jwtPayload') as JWTPayload;
    if (!payload || !roles.includes(payload.role)) {
      return c.json(fail('Forbidden'), 403);
    }
    await next();
  };
}
