import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceLogs, employees } from '../../db/schema';
import { isWithinRadius, calculateDistance } from '../../shared/utils/geo';
import { calculateWorkHours, calculateOTHours, isLate, todayDate, timeToMinutes } from '../../shared/utils/time';
import { getEmployee } from '../employees/service';
import { listLocations } from '../locations/service';
import { wsManager } from '../../shared/ws/manager';
import { createEvent } from '../../shared/ws/events';

export async function getLogs(filter: {
  employeeId?: string; date?: string; startDate?: string; endDate?: string; status?: string;
  page?: number; limit?: number;
}) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filter.employeeId) conditions.push(eq(attendanceLogs.employeeId, filter.employeeId));
  if (filter.date) conditions.push(eq(attendanceLogs.date, filter.date));
  if (filter.status) conditions.push(eq(attendanceLogs.status, filter.status as 'present' | 'late' | 'absent' | 'on_leave'));

  const where = conditions.length ? and(...conditions) : undefined;

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
    db.select({ total: count() }).from(attendanceLogs).where(where),
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
    throw Object.assign(new Error('Already checked in today'), { status: 400 });
  }

  // Geofence check
  let locationId: string | null = null;
  if (employee.locationId) {
    const locations = await listLocations();
    const loc = locations.find((l) => l.id === employee.locationId);
    if (loc) {
      const within = isWithinRadius(lat, lng, loc.lat, loc.lng, loc.radiusMeters);
      if (!within) {
        const dist = Math.round(calculateDistance(lat, lng, loc.lat, loc.lng));
        throw Object.assign(
          new Error(`นอกพื้นที่ (ระยะห่าง ${dist} เมตร, รัศมี ${loc.radiusMeters} เมตร)`),
          { status: 400 }
        );
      }
      locationId = loc.id;
    }
  }

  const now = new Date().toISOString();
  const late = isLate(employee.shiftStartTime, now);
  const status = late ? 'late' : 'present';
  const id = `log_${Date.now()}`;

  const checkInDate = new Date(now);
  const minutesLate = late
    ? Math.round(
        (checkInDate.getHours() * 60 + checkInDate.getMinutes()) -
        timeToMinutes(employee.shiftStartTime)
      )
    : 0;

  if (existing) {
    await db.update(attendanceLogs)
      .set({ checkInTime: new Date(now), checkInLat: lat, checkInLng: lng, status, locationId, updatedAt: new Date() })
      .where(eq(attendanceLogs.id, existing.id));
    wsManager.broadcast(createEvent(
      late ? 'LATE' : 'CHECK_IN',
      employeeId,
      employee.name,
      { locationName: locationId ?? 'ไม่ระบุ', time: now, minutesLate }
    ));
    return getTodayLog(employeeId);
  }

  await db.insert(attendanceLogs).values({
    id, employeeId, date: today,
    checkInTime: new Date(now),
    checkInLat: lat, checkInLng: lng,
    status, locationId,
    workHours: 0, otHours: 0,
  });

  wsManager.broadcast(createEvent(
    late ? 'LATE' : 'CHECK_IN',
    employeeId,
    employee.name,
    { locationName: locationId ?? 'ไม่ระบุ', time: now, minutesLate }
  ));

  return getTodayLog(employeeId);
}

export async function checkOut(employeeId: string, lat: number, lng: number) {
  const employee = await getEmployee(employeeId);
  const log = await getTodayLog(employeeId);

  if (!log?.checkInTime) throw Object.assign(new Error('ยังไม่ได้ check-in วันนี้'), { status: 400 });
  if (log.checkOutTime) throw Object.assign(new Error('Check-out แล้ววันนี้'), { status: 400 });

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
  const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.checkInTime) updates.checkInTime = new Date(data.checkInTime);
  if (data.checkOutTime) updates.checkOutTime = new Date(data.checkOutTime);
  await db.update(attendanceLogs).set(updates).where(eq(attendanceLogs.id, id));
}
