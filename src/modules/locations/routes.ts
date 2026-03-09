import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { ok } from '../../shared/utils/response';
import { createLocationSchema, updateLocationSchema } from './schema';
import { listLocations, createLocation, updateLocation, removeLocation } from './service';

const locationsRouter = new Hono();
locationsRouter.use('*', authMiddleware);

locationsRouter.get('/', async (c) => {
  return c.json(ok(await listLocations()));
});

locationsRouter.post('/', guardRole('admin'), zValidator('json', createLocationSchema), async (c) => {
  const data = await createLocation(c.req.valid('json'));
  return c.json(ok(data, 'Location created'), 201);
});

locationsRouter.put('/:id', guardRole('admin'), zValidator('json', updateLocationSchema), async (c) => {
  const data = await updateLocation(c.req.param('id'), c.req.valid('json'));
  return c.json(ok(data, 'Location updated'));
});

locationsRouter.delete('/:id', guardRole('admin'), async (c) => {
  await removeLocation(c.req.param('id'));
  return c.json(ok(null, 'Location deleted'));
});

export default locationsRouter;
