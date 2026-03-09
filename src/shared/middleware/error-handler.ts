import type { Context } from 'hono';
import { ZodError } from 'zod';
import { fail } from '../utils/response';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ZodError) {
    return c.json(fail(err.errors.map((e) => e.message).join(', ')), 400);
  }

  const status = (err as { status?: number }).status ?? 500;
  return c.json(fail(err.message || 'Internal server error'), status as 400 | 401 | 403 | 404 | 500);
}
