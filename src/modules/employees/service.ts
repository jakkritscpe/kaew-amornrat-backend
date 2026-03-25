import { eq, ilike, and, count, isNull, type SQL } from 'drizzle-orm';
import { QR_TOKEN_VALIDITY_DAYS } from '../../shared/config';
import { badRequest, unauthorized, notFound, preconditionRequired } from '../../shared/utils/errors';
import { db } from '../../db';
import { employees } from '../../db/schema';
import { hashPassword } from '../auth/service';

export async function setAdminPin(employeeId: string, pin: string, currentPin?: string): Promise<void> {
  const [row] = await db.select({ adminPinHash: employees.adminPinHash, deletedAt: employees.deletedAt })
    .from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!row || row.deletedAt) throw notFound('Employee not found');

  if (row.adminPinHash) {
    if (!currentPin) throw badRequest('Current PIN required');
    const valid = await Bun.password.verify(currentPin, row.adminPinHash);
    if (!valid) throw unauthorized('Current PIN incorrect');
  }

  const hash = await Bun.password.hash(pin);
  await db.update(employees).set({ adminPinHash: hash, updatedAt: new Date() }).where(eq(employees.id, employeeId));
}

export async function verifyAdminPin(employeeId: string, pin: string): Promise<boolean> {
  const [row] = await db.select({ adminPinHash: employees.adminPinHash, deletedAt: employees.deletedAt })
    .from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!row || row.deletedAt) throw notFound('Employee not found');
  if (!row.adminPinHash) throw preconditionRequired('PIN not set');
  return Bun.password.verify(pin, row.adminPinHash);
}

function parseAccessibleMenus(raw: string | null): string[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export async function listEmployees(filter: {
  department?: string; role?: string; search?: string; page?: number; limit?: number;
}) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [isNull(employees.deletedAt)];
  if (filter.department) conditions.push(eq(employees.department, filter.department));
  if (filter.role) conditions.push(eq(employees.role, filter.role as 'admin' | 'manager' | 'employee'));
  if (filter.search) conditions.push(ilike(employees.name, `%${filter.search}%`));

  const where = and(...conditions);
  const selectedFields = {
    id: employees.id,
    name: employees.name,
    nickname: employees.nickname,
    email: employees.email,
    department: employees.department,
    position: employees.position,
    role: employees.role,
    shiftStartTime: employees.shiftStartTime,
    shiftEndTime: employees.shiftEndTime,
    locationId: employees.locationId,
    baseWage: employees.baseWage,
    otRateUseDefault: employees.otRateUseDefault,
    otRateType: employees.otRateType,
    otRateValue: employees.otRateValue,
    avatarUrl: employees.avatarUrl,
    accessibleMenus: employees.accessibleMenus,
    createdAt: employees.createdAt,
  };

  const [rows, [{ total }]] = await Promise.all([
    db.select(selectedFields).from(employees).where(where).limit(limit).offset(offset),
    db.select({ total: count() }).from(employees).where(where),
  ]);

  return {
    data: rows.map(row => ({ ...row, accessibleMenus: parseAccessibleMenus(row.accessibleMenus) })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getEmployee(id: string) {
  const [row] = await db
    .select({
      id: employees.id,
      name: employees.name,
      nickname: employees.nickname,
      email: employees.email,
      department: employees.department,
      position: employees.position,
      role: employees.role,
      shiftStartTime: employees.shiftStartTime,
      shiftEndTime: employees.shiftEndTime,
      locationId: employees.locationId,
      baseWage: employees.baseWage,
      otRateUseDefault: employees.otRateUseDefault,
      otRateType: employees.otRateType,
      otRateValue: employees.otRateValue,
      avatarUrl: employees.avatarUrl,
      qrToken: employees.qrToken,
      accessibleMenus: employees.accessibleMenus,
      createdAt: employees.createdAt,
    })
    .from(employees)
    .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
    .limit(1);

  if (!row) throw notFound('Employee not found');
  return { ...row, accessibleMenus: parseAccessibleMenus(row.accessibleMenus) };
}

export async function createEmployee(data: {
  name: string; nickname?: string; email: string; password: string;
  department: string; position: string; role: 'admin' | 'manager' | 'employee';
  shiftStartTime: string; shiftEndTime: string; locationId?: string;
  baseWage?: number; otRateUseDefault: boolean; otRateType?: 'multiplier' | 'fixed';
  otRateValue?: number; avatarUrl?: string;
}) {
  const id = `emp_${crypto.randomUUID()}`;
  const passwordHash = await hashPassword(data.password);
  const qrToken = crypto.randomUUID();
  const qrTokenExpiresAt = new Date(Date.now() + QR_TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const { password: _, ...rest } = data;

  await db.insert(employees).values({
    id,
    passwordHash,
    qrToken,
    qrTokenExpiresAt,
    ...rest,
    baseWage: data.baseWage?.toString(),
  });

  return getEmployee(id);
}

export async function updateEmployee(id: string, data: Partial<{
  name: string; nickname?: string; email: string; password?: string;
  department: string; position: string; role: 'admin' | 'manager' | 'employee';
  shiftStartTime: string; shiftEndTime: string; locationId?: string;
  baseWage?: number; otRateUseDefault: boolean; otRateType?: 'multiplier' | 'fixed';
  otRateValue?: number; avatarUrl?: string; accessibleMenus?: string[];
  qrToken?: string; qrTokenExpiresAt?: Date;
}>) {
  await getEmployee(id); // throws 404 if not found or soft-deleted
  const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.password) {
    updates.passwordHash = await hashPassword(data.password);
  }
  delete updates.password;
  if (data.baseWage !== undefined) updates.baseWage = data.baseWage?.toString();
  if ('accessibleMenus' in data) updates.accessibleMenus = JSON.stringify(data.accessibleMenus);

  await db.update(employees).set(updates).where(eq(employees.id, id));
  return getEmployee(id);
}

export async function removeEmployee(id: string) {
  await db.update(employees)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(employees.id, id));
}
