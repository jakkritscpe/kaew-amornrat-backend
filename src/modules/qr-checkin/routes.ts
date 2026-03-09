import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ok } from '../../shared/utils/response';
import { getEmployeePublicInfo, qrCheckIn } from './service';

const qrRouter = new Hono();

qrRouter.get('/:employeeId', async (c) => {
  return c.json(ok(await getEmployeePublicInfo(c.req.param('employeeId'))));
});

qrRouter.post('/:employeeId', zValidator('json', z.object({ lat: z.number(), lng: z.number() })), async (c) => {
  const { lat, lng } = c.req.valid('json');
  const result = await qrCheckIn(c.req.param('employeeId'), lat, lng);
  return c.json(ok(result, result.action === 'check-in' ? 'Check-in สำเร็จ' : 'Check-out สำเร็จ'));
});

export default qrRouter;
