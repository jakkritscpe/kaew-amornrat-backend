import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { rateLimit } from '../../shared/middleware/rate-limit';
import { ok, fail } from '../../shared/utils/response';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema, updateMenusSchema, verifyPinSchema, setPinSchema } from './schema';
import { listEmployees, getEmployee, createEmployee, updateEmployee, removeEmployee, verifyAdminPin, setAdminPin } from './service';
import { QR_TOKEN_VALIDITY_DAYS } from '../../shared/config';
import type { JWTPayload } from '../../shared/types';

const employeesRouter = new Hono();
employeesRouter.use('*', authMiddleware);

employeesRouter.get('/', guardRole('admin', 'manager'), zValidator('query', listEmployeesSchema), async (c) => {
  const filter = c.req.valid('query');
  const data = await listEmployees(filter);
  return c.json(ok(data));
});

// PUT /api/employees/:id/menus (admin only - update accessible menus)
employeesRouter.put('/:id/menus', guardRole('admin'), zValidator('json', updateMenusSchema), async (c) => {
  const { accessibleMenus } = c.req.valid('json');
  const data = await updateEmployee(c.req.param('id'), { accessibleMenus });
  return c.json(ok(data, 'Menus updated'));
});

employeesRouter.get('/:id', guardRole('admin', 'manager'), async (c) => {
  const data = await getEmployee(c.req.param('id'));
  return c.json(ok(data));
});

employeesRouter.post('/', guardRole('admin'), zValidator('json', createEmployeeSchema), async (c) => {
  const body = c.req.valid('json');
  const data = await createEmployee(body);
  return c.json(ok(data, 'Employee created'), 201);
});

// POST /api/employees/verify-pin — tightly rate-limited to prevent PIN brute-force
employeesRouter.post('/verify-pin', rateLimit(5, 15 * 60 * 1000), guardRole('admin', 'manager'), zValidator('json', verifyPinSchema), async (c) => {
  const { pin } = c.req.valid('json');
  const payload = c.get('jwtPayload') as JWTPayload;
  const valid = await verifyAdminPin(payload.sub, pin);
  if (!valid) return c.json(fail('PIN ไม่ถูกต้อง'), 401);
  return c.json(ok({ verified: true }));
});

// POST /api/employees/set-pin
employeesRouter.post('/set-pin', guardRole('admin', 'manager'), zValidator('json', setPinSchema), async (c) => {
  const { pin, currentPin } = c.req.valid('json');
  const payload = c.get('jwtPayload') as JWTPayload;
  await setAdminPin(payload.sub, pin, currentPin);
  return c.json(ok(null, 'ตั้งรหัส PIN แล้ว'));
});

employeesRouter.put('/:id', guardRole('admin', 'manager'), zValidator('json', updateEmployeeSchema), async (c) => {
  const body = c.req.valid('json');
  const data = await updateEmployee(c.req.param('id'), body);
  return c.json(ok(data, 'Employee updated'));
});

employeesRouter.delete('/:id', guardRole('admin'), async (c) => {
  await removeEmployee(c.req.param('id'));
  return c.json(ok(null, 'Employee deleted'));
});

// GET /api/employees/:id/qr-token (admin/manager only - get QR URL for printing)
employeesRouter.get('/:id/qr-token', guardRole('admin', 'manager'), async (c) => {
  const employee = await getEmployee(c.req.param('id'));
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return c.json(ok({
    employeeId: employee.id,
    employeeName: employee.name,
    qrUrl: `${frontendUrl}/employee/qr-login/${employee.qrToken}`,
  }));
});

// POST /api/employees/:id/regenerate-qr (admin only - revoke and regenerate)
employeesRouter.post('/:id/regenerate-qr', guardRole('admin'), async (c) => {
  const newToken = crypto.randomUUID();
  const qrTokenExpiresAt = new Date(Date.now() + QR_TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  await updateEmployee(c.req.param('id'), { qrToken: newToken, qrTokenExpiresAt });
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return c.json(ok({
    qrUrl: `${frontendUrl}/employee/qr-login/${newToken}`,
    expiresAt: qrTokenExpiresAt.toISOString(),
  }, 'QR code regenerated'));
});

export default employeesRouter;
