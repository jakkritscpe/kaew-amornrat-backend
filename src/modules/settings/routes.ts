import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { ok } from '../../shared/utils/response';
import { updateSettingsSchema } from './schema';
import { getSettings, updateSettings } from './service';

const settingsRouter = new Hono();
settingsRouter.use('*', authMiddleware);

settingsRouter.get('/', async (c) => c.json(ok(await getSettings())));

settingsRouter.put('/', guardRole('admin'), zValidator('json', updateSettingsSchema), async (c) => {
  return c.json(ok(await updateSettings(c.req.valid('json')), 'Settings updated'));
});

export default settingsRouter;
