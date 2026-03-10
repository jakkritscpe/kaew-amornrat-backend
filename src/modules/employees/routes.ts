import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import { ok } from '../../shared/utils/response';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema } from './schema';
import { listEmployees, getEmployee, createEmployee, updateEmployee, removeEmployee } from './service';

const employeesRouter = new Hono();
employeesRouter.use('*', authMiddleware);

employeesRouter.get('/', guardRole('admin', 'manager'), zValidator('query', listEmployeesSchema), async (c) => {
  const filter = c.req.valid('query');
  const data = await listEmployees(filter);
  return c.json(ok(data));
});

// PUT /api/employees/:id/menus (admin only - update accessible menus)
employeesRouter.put('/:id/menus', guardRole('admin'), async (c) => {
  const body = await c.req.json() as { accessibleMenus: string[] };
  const data = await updateEmployee(c.req.param('id'), { accessibleMenus: body.accessibleMenus } as any);
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

employeesRouter.put('/:id', guardRole('admin'), zValidator('json', updateEmployeeSchema), async (c) => {
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
    qrToken: employee.qrToken,
  }));
});

// POST /api/employees/:id/regenerate-qr (admin only - revoke and regenerate)
employeesRouter.post('/:id/regenerate-qr', guardRole('admin'), async (c) => {
  const newToken = crypto.randomUUID();
  await updateEmployee(c.req.param('id'), { qrToken: newToken } as any);
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return c.json(ok({
    qrUrl: `${frontendUrl}/employee/qr-login/${newToken}`,
    qrToken: newToken,
  }, 'QR code regenerated'));
});

export default employeesRouter;
