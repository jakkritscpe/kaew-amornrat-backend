import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { ok } from '../../shared/utils/response';
import { submitOTSchema, updateOTStatusSchema, listOTSchema } from './schema';
import { listOTRequests, submitOTRequest, updateOTStatus } from './service';
import type { JWTPayload } from '../../shared/types';

const otRouter = new Hono();
otRouter.use('*', authMiddleware);

otRouter.get('/', guardRole('admin', 'manager'), zValidator('query', listOTSchema), async (c) => {
  return c.json(ok(await listOTRequests(c.req.valid('query'))));
});

otRouter.get('/my', async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  return c.json(ok(await listOTRequests({ employeeId: payload.sub })));
});

otRouter.post('/', zValidator('json', submitOTSchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const data = await submitOTRequest(payload.sub, c.req.valid('json'));
  return c.json(ok(data, 'ส่งคำขอ OT แล้ว'), 201);
});

otRouter.patch('/:id/status', guardRole('admin', 'manager'), zValidator('json', updateOTStatusSchema), async (c) => {
  await updateOTStatus(c.req.param('id'), c.req.valid('json').status);
  return c.json(ok(null, 'อัปเดตสถานะ OT แล้ว'));
});

export default otRouter;
