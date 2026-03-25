import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { loginSchema } from './schema';
import { loginService, qrLoginService } from './service';
import { authMiddleware } from '../../shared/middleware/auth';
import { rateLimit } from '../../shared/middleware/rate-limit';
import { ok, fail } from '../../shared/utils/response';
import { db } from '../../db';
import { employees } from '../../db/schema';
import type { JWTPayload } from '../../shared/types';

const auth = new Hono();

const IS_PROD = process.env.NODE_ENV === 'production';

/** Set the auth HttpOnly cookie — keeps JWTs out of localStorage (XSS mitigation).
 *  Production: SameSite=None; Secure — required when frontend and backend are on different
 *  domains (e.g. separate onrender.com subdomains). CSRF is mitigated by:
 *    1. All mutation endpoints require Content-Type: application/json (zValidator) so
 *       HTML form submissions (which use form-encoded content-type) are rejected.
 *    2. CORS origin whitelist prevents unauthorised cross-origin fetch with credentials.
 *  Development: SameSite=Lax — frontend and backend share the same localhost origin. */
function setAuthCookie(c: Parameters<typeof setCookie>[0], token: string, maxAgeSeconds: number) {
  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    path: '/',
    sameSite: IS_PROD ? 'None' : 'Lax',
    secure: IS_PROD,
    maxAge: maxAgeSeconds,
  });
}

// 10 login attempts per 15 minutes per IP
const loginRateLimit = rateLimit(10, 15 * 60 * 1000);

// POST /api/auth/login
auth.post('/login', loginRateLimit, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const { token, user } = await loginService(email, password);
  setAuthCookie(c, token, 7 * 24 * 60 * 60); // 7 days
  return c.json(ok({ user }, 'Login successful'));
});

// GET /api/auth/me — returns full profile from DB (used to restore session on page refresh)
// Rate-limited to prevent enumeration; 60 req/min is generous for normal page refreshes
const meRateLimit = rateLimit(60, 60 * 1000);
auth.get('/me', meRateLimit, authMiddleware, async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const [emp] = await db
    .select({
      id: employees.id, name: employees.name, email: employees.email, role: employees.role,
      department: employees.department, position: employees.position, accessibleMenus: employees.accessibleMenus,
    })
    .from(employees).where(eq(employees.id, payload.sub)).limit(1);
  if (!emp) return c.json(fail('User not found'), 404);

  return c.json(ok({
    id: emp.id, name: emp.name, email: emp.email, role: emp.role,
    department: emp.department, position: emp.position,
    accessibleMenus: (() => { try { return emp.accessibleMenus ? JSON.parse(emp.accessibleMenus) : []; } catch { return []; } })(),
  }));
});

// POST /api/auth/logout
auth.post('/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/', sameSite: IS_PROD ? 'None' : 'Lax', secure: IS_PROD });
  return c.json(ok(null, 'Logged out'));
});

// POST /api/auth/qr-login
auth.post('/qr-login', loginRateLimit, zValidator('json', z.object({ token: z.string() })), async (c) => {
  const { token } = c.req.valid('json');
  const { token: jwt, user } = await qrLoginService(token);
  setAuthCookie(c, jwt, 30 * 24 * 60 * 60); // 30 days
  return c.json(ok({ user }, 'Login successful'));
});

export default auth;
