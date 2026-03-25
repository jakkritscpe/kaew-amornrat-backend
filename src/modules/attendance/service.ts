import { eq, and, desc, count, gte, lte, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceLogs, employees, workLocations } from '../../db/schema';
import { isWithinRadius, calculateDistance } from '../../shared/utils/geo';
import { calculateWorkHours, calculateOTHours, isLate, minutesLate, todayDate } from '../../shared/utils/time';
import { getEmployee } from '../employees/service';
import { wsManager } from '../../shared/ws/manager';
import { createEvent } from '../../shared/ws/events';
import { badRequest, notFound } from '../../shared/utils/errors';

export async function getLogs(filter: {
  employeeId?: string; date?: string; startDate?: string; endDate?: string; status?: string;
  page?: number; limit?: number;
}) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [isNull(employees.deletedAt)];
  if (filter.employeeId) conditions.push(eq(attendanceLogs.employeeId, filter.employeeId));
  if (filter.date) conditions.push(eq(attendanceLogs.date, filter.date));
  if (filter.startDate) conditions.push(gte(attendanceLogs.date, filter.startDate));
  if (filter.endDate) conditions.push(lte(attendanceLogs.date, filter.endDate));
  if (filter.status) conditions.push(eq(attendanceLogs.status, filter.status as 'present' | 'late' | 'absent' | 'on_leave'));

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        log: attendanceLogs,
        employeeName: employees.name,
        employeeDepartment: employees.department,
      })
      .from(attendanceLogs)
      .leftJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .where(where)
      .orderBy(desc(attendanceLogs.date))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() })
      .from(attendanceLogs)
      .leftJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .where(where),
  ]);

  return {
    data: rows.map(({ log, employeeName, employeeDepartment }) => ({
      ...log,
      employeeName,
      employeeDepartment,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTodayLog(employeeId: string) {
  const today = todayDate();
  const [row] = await db
    .select()
    .from(attendanceLogs)
    .where(and(eq(attendanceLogs.employeeId, employeeId), eq(attendanceLogs.date, today)))
    .limit(1);
  return row ?? null;
}

export async function checkIn(employeeId: string, lat: number, lng: number) {
  const employee = await getEmployee(employeeId);
  const today = todayDate();

  // Check already checked in
  const existing = await getTodayLog(employeeId);
  if (existing?.checkInTime) {
    throw badRequest('Already checked in today');
  }

  // Geofence check — direct single-row query instead of loading all locations
  let locationId: string | null = null;
  if (employee.locationId) {
    const [loc] = await db
      .select({ id: workLocations.id, lat: workLocations.lat, lng: workLocations.lng, radiusMeters: workLocations.radiusMeters })
      .from(workLocations)
      .where(and(eq(workLocations.id, employee.locationId), isNull(workLocations.deletedAt)))
      .limit(1);
    if (!loc) {
      // Location was soft-deleted but employee still references it — block check-in
      throw badRequest('สถานที่ทำงานที่กำหนดไว้ถูกลบแล้ว กรุณาติดต่อผู้ดูแลระบบ');
    }
    const within = isWithinRadius(lat, lng, loc.lat, loc.lng, loc.radiusMeters);
    if (!within) {
      const dist = Math.round(calculateDistance(lat, lng, loc.lat, loc.lng));
      throw badRequest(`อยู่นอกพื้นที่ที่กำหนด (ระยะห่าง ${dist} เมตร)`);
    }
    locationId = loc.id;
  }

  const now = new Date().toISOString();
  const late = isLate(employee.shiftStartTime, now);
  const status = late ? 'late' : 'present';
  const id = `log_${crypto.randomUUID()}`;

  const lateMinutes = late ? Math.round(minutesLate(employee.shiftStartTime, now)) : 0;

  if (existing) {
    await db.update(attendanceLogs)
      .set({ checkInTime: new Date(now), checkInLat: lat, checkInLng: lng, status, locationId, updatedAt: new Date() })
      .where(eq(attendanceLogs.id, existing.id));
    wsManager.broadcast(createEvent(
      late ? 'LATE' : 'CHECK_IN',
      employeeId,
      employee.name,
      { locationName: locationId ?? 'ไม่ระบุ', time: now, minutesLate: lateMinutes }
    ));
    return getTodayLog(employeeId);
  }

  try {
    await db.insert(attendanceLogs).values({
      id, employeeId, date: today,
      checkInTime: new Date(now),
      checkInLat: lat, checkInLng: lng,
      status, locationId,
      workHours: 0, otHours: 0,
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      throw badRequest('Already checked in today');
    }
    throw e;
  }

  wsManager.broadcast(createEvent(
    late ? 'LATE' : 'CHECK_IN',
    employeeId,
    employee.name,
    { locationName: locationId ?? 'ไม่ระบุ', time: now, minutesLate: lateMinutes }
  ));

  return getTodayLog(employeeId);
}

export async function checkOut(employeeId: string, lat: number, lng: number) {
  const employee = await getEmployee(employeeId);
  const log = await getTodayLog(employeeId);

  if (!log?.checkInTime) throw badRequest('ยังไม่ได้ check-in วันนี้');
  if (log.checkOutTime) throw badRequest('Check-out แล้ววันนี้');

  const now = new Date().toISOString();
  const workHours = calculateWorkHours(log.checkInTime.toISOString(), now);
  const otHours = calculateOTHours(workHours, employee.shiftStartTime, employee.shiftEndTime);

  await db.update(attendanceLogs)
    .set({
      checkOutTime: new Date(now),
      checkOutLat: lat, checkOutLng: lng,
      workHours, otHours,
      updatedAt: new Date(),
    })
    .where(eq(attendanceLogs.id, log.id));

  wsManager.broadcast(createEvent(
    'CHECK_OUT',
    employeeId,
    employee.name,
    { workHours: Number(workHours.toFixed(2)), otHours: Number(otHours.toFixed(2)), time: now }
  ));

  return getTodayLog(employeeId);
}

export async function updateLog(id: string, data: Partial<{
  checkInTime: string; checkOutTime: string;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  workHours: number; otHours: number;
}>) {
  const [existing] = await db
    .select({ id: attendanceLogs.id, employeeId: attendanceLogs.employeeId, date: attendanceLogs.date, checkInTime: attendanceLogs.checkInTime, checkOutTime: attendanceLogs.checkOutTime })
    .from(attendanceLogs).where(eq(attendanceLogs.id, id)).limit(1);
  if (!existing) throw notFound('Attendance log not found');

  // Prevent shifting checkInTime to a different calendar date — would corrupt the (employee_id, date) record
  if (data.checkInTime) {
    const newDate = new Date(data.checkInTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    if (newDate !== existing.date) {
      throw badRequest('ไม่สามารถเปลี่ยนวันที่ของ check-in ได้ (ต้องอยู่ในวันที่เดิม)');
    }
  }

  const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.checkInTime) updates.checkInTime = new Date(data.checkInTime);
  if (data.checkOutTime) updates.checkOutTime = new Date(data.checkOutTime);

  // Recalculate workHours and otHours if any time was changed
  if (data.checkInTime || data.checkOutTime) {
    const newCheckIn = (updates.checkInTime as Date | undefined) ?? existing.checkInTime;
    const newCheckOut = (updates.checkOutTime as Date | undefined) ?? existing.checkOutTime;
    if (newCheckIn && newCheckOut) {
      const [emp] = await db
        .select({ shiftStartTime: employees.shiftStartTime, shiftEndTime: employees.shiftEndTime })
        .from(employees).where(eq(employees.id, existing.employeeId)).limit(1);
      if (emp) {
        updates.workHours = calculateWorkHours(newCheckIn.toISOString(), newCheckOut.toISOString());
        updates.otHours = calculateOTHours(updates.workHours as number, emp.shiftStartTime, emp.shiftEndTime);
      }
    }
  }

  await db.update(attendanceLogs).set(updates).where(eq(attendanceLogs.id, id));
  const [updated] = await db.select().from(attendanceLogs).where(eq(attendanceLogs.id, id)).limit(1);
  return updated;
}
