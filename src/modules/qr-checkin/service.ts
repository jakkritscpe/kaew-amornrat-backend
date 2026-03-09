import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { employees } from '../../db/schema';
import { checkIn, checkOut, getTodayLog } from '../attendance/service';

export async function getEmployeePublicInfo(employeeId: string) {
  const [row] = await db
    .select({ id: employees.id, name: employees.name, position: employees.position, avatarUrl: employees.avatarUrl })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!row) throw Object.assign(new Error('Employee not found'), { status: 404 });
  return row;
}

export async function qrCheckIn(employeeId: string, lat: number, lng: number) {
  const todayLog = await getTodayLog(employeeId);
  if (todayLog?.checkInTime && !todayLog?.checkOutTime) {
    return { action: 'check-out', log: await checkOut(employeeId, lat, lng) };
  }
  return { action: 'check-in', log: await checkIn(employeeId, lat, lng) };
}
