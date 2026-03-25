import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../../db';
import { employees } from '../../db/schema';
import { notFound, gone } from '../../shared/utils/errors';
import { checkIn, checkOut, getTodayLog } from '../attendance/service';

async function resolveEmployeeId(qrToken: string): Promise<string> {
  const [row] = await db
    .select({ id: employees.id, qrTokenExpiresAt: employees.qrTokenExpiresAt })
    .from(employees)
    .where(and(eq(employees.qrToken, qrToken), isNull(employees.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Employee not found');
  if (row.qrTokenExpiresAt && row.qrTokenExpiresAt < new Date()) {
    throw gone('QR code หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ');
  }
  return row.id;
}

export async function getEmployeePublicInfo(qrToken: string) {
  const [row] = await db
    .select({ id: employees.id, name: employees.name, position: employees.position, avatarUrl: employees.avatarUrl, qrTokenExpiresAt: employees.qrTokenExpiresAt })
    .from(employees)
    .where(and(eq(employees.qrToken, qrToken), isNull(employees.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Employee not found');
  if (row.qrTokenExpiresAt && row.qrTokenExpiresAt < new Date()) {
    throw gone('QR code หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ');
  }
  const { qrTokenExpiresAt: _, ...publicInfo } = row;
  return publicInfo;
}

export async function qrCheckIn(qrToken: string, lat: number, lng: number) {
  const employeeId = await resolveEmployeeId(qrToken);
  const todayLog = await getTodayLog(employeeId);
  if (todayLog?.checkInTime && !todayLog?.checkOutTime) {
    return { action: 'check-out', log: await checkOut(employeeId, lat, lng) };
  }
  return { action: 'check-in', log: await checkIn(employeeId, lat, lng) };
}
