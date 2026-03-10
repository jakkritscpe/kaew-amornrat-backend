import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { ok } from '../../shared/utils/response';
import { checkInSchema, checkOutSchema, listLogsSchema, updateLogSchema } from './schema';
import { getLogs, getTodayLog, checkIn, checkOut, updateLog } from './service';
import type { JWTPayload } from '../../shared/types';

const attendanceRouter = new Hono();
attendanceRouter.use('*', authMiddleware);

attendanceRouter.get('/logs', guardRole('admin', 'manager'), zValidator('query', listLogsSchema), async (c) => {
  return c.json(ok(await getLogs(c.req.valid('query'))));
});

attendanceRouter.get('/logs/today', async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  return c.json(ok(await getTodayLog(payload.sub)));
});

attendanceRouter.get('/logs/:employeeId', guardRole('admin', 'manager'), zValidator('query', listLogsSchema), async (c) => {
  const query = c.req.valid('query');
  return c.json(ok(await getLogs({ ...query, employeeId: c.req.param('employeeId') })));
});

attendanceRouter.post('/check-in', zValidator('json', checkInSchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { lat, lng } = c.req.valid('json');
  const log = await checkIn(payload.sub, lat, lng);
  return c.json(ok(log, 'Check-in สำเร็จ'));
});

attendanceRouter.post('/check-out', zValidator('json', checkOutSchema), async (c) => {
  const payload = c.get('jwtPayload') as JWTPayload;
  const { lat, lng } = c.req.valid('json');
  const log = await checkOut(payload.sub, lat, lng);
  return c.json(ok(log, 'Check-out สำเร็จ'));
});

attendanceRouter.patch('/logs/:id', guardRole('admin'), zValidator('json', updateLogSchema), async (c) => {
  await updateLog(c.req.param('id'), c.req.valid('json'));
  return c.json(ok(null, 'Log updated'));
});

export default attendanceRouter;
