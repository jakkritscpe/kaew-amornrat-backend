import { eq, ilike, and, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { employees } from '../../db/schema';
import { hashPassword } from '../auth/service';

export async function listEmployees(filter: { department?: string; role?: string; search?: string }) {
  const conditions: SQL[] = [];
  if (filter.department) conditions.push(eq(employees.department, filter.department));
  if (filter.role) conditions.push(eq(employees.role, filter.role as 'admin' | 'manager' | 'employee'));
  if (filter.search) conditions.push(ilike(employees.name, `%${filter.search}%`));

  const rows = await db
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
      createdAt: employees.createdAt,
    })
    .from(employees)
    .where(conditions.length ? and(...conditions) : undefined);

  return rows;
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
      createdAt: employees.createdAt,
    })
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);

  if (!row) throw Object.assign(new Error('Employee not found'), { status: 404 });
  return row;
}

export async function createEmployee(data: {
  name: string; nickname?: string; email: string; password: string;
  department: string; position: string; role: 'admin' | 'manager' | 'employee';
  shiftStartTime: string; shiftEndTime: string; locationId?: string;
  baseWage?: number; otRateUseDefault: boolean; otRateType?: 'multiplier' | 'fixed';
  otRateValue?: number; avatarUrl?: string;
}) {
  const id = `emp_${Date.now()}`;
  const passwordHash = await hashPassword(data.password);
  const qrToken = crypto.randomUUID();
  const { password: _, ...rest } = data;

  await db.insert(employees).values({
    id,
    passwordHash,
    qrToken,
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
  otRateValue?: number; avatarUrl?: string;
}>) {
  const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.password) {
    updates.passwordHash = await hashPassword(data.password);
  }
  delete updates.password;
  if (data.baseWage !== undefined) updates.baseWage = data.baseWage?.toString();

  await db.update(employees).set(updates).where(eq(employees.id, id));
  return getEmployee(id);
}

export async function removeEmployee(id: string) {
  await db.delete(employees).where(eq(employees.id, id));
}
