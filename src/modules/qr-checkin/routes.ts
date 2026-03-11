import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ok } from '../../shared/utils/response';
import { rateLimit } from '../../shared/middleware/rate-limit';
import { qrCheckInBodySchema } from './schema';
import { getEmployeePublicInfo, qrCheckIn } from './service';

const qrRouter = new Hono();

// 20 lookups per 5 min per IP (QR page loads employee info on mount)
const qrInfoRateLimit = rateLimit(20, 5 * 60 * 1000);
// 10 check-in/out actions per 15 min per IP
const qrActionRateLimit = rateLimit(10, 15 * 60 * 1000);

qrRouter.get('/:employeeId', qrInfoRateLimit, async (c) => {
  return c.json(ok(await getEmployeePublicInfo(c.req.param('employeeId'))));
});

qrRouter.post(
  '/:employeeId',
  qrActionRateLimit,
  zValidator('json', qrCheckInBodySchema),
  async (c) => {
    const { lat, lng } = c.req.valid('json');
    const result = await qrCheckIn(c.req.param('employeeId'), lat, lng);
    return c.json(ok(result, result.action === 'check-in' ? 'Check-in สำเร็จ' : 'Check-out สำเร็จ'));
  }
);

export default qrRouter;
