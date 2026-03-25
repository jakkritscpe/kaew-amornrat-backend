import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { ok } from '../../shared/utils/response';
import { createHolidaySchema, updateHolidaySchema } from './schema';
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from './service';

const holidaysRouter = new Hono();
holidaysRouter.use('*', authMiddleware);

// GET /api/holidays?year=2025
holidaysRouter.get('/', async (c) => {
  const yearParam = c.req.query('year');
  const year = yearParam ? parseInt(yearParam, 10) : undefined;
  return c.json(ok(await listHolidays(year)));
});

// POST /api/holidays (admin only)
holidaysRouter.post('/', guardRole('admin'), zValidator('json', createHolidaySchema), async (c) => {
  const data = c.req.valid('json');
  return c.json(ok(await createHoliday(data), 'Holiday created'), 201);
});

// PUT /api/holidays/:id (admin only)
holidaysRouter.put('/:id', guardRole('admin'), zValidator('json', updateHolidaySchema), async (c) => {
  const data = c.req.valid('json');
  return c.json(ok(await updateHoliday(c.req.param('id'), data), 'Holiday updated'));
});

// DELETE /api/holidays/:id (admin only)
holidaysRouter.delete('/:id', guardRole('admin'), async (c) => {
  await deleteHoliday(c.req.param('id'));
  return c.json(ok(null, 'Holiday deleted'));
});

export default holidaysRouter;
