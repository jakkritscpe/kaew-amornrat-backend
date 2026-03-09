import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { loginSchema } from './schema';
import { loginService, qrLoginService } from './service';
import { authMiddleware } from '../../shared/middleware/auth';
import { ok, fail } from '../../shared/utils/response';
import type { JWTPayload } from '../../shared/types';

const auth = new Hono();

// POST /api/auth/login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const result = await loginService(email, password);
  return c.json(ok(result, 'Login successful'));
});

// GET /api/auth/me
auth.get('/me', authMiddleware, (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  return c.json(ok(payload));
});

// POST /api/auth/qr-login
auth.post('/qr-login', zValidator('json', z.object({ token: z.string() })), async (c) => {
  const { token } = c.req.valid('json');
  const result = await qrLoginService(token);
  return c.json(ok(result, 'Login successful'));
});

export default auth;
