import { eq, and, count, desc, isNull, type SQL } from 'drizzle-orm';
import { notFound } from '../../shared/utils/errors';
import { db } from '../../db';
import { otRequests, employees, attendanceLogs } from '../../db/schema';
import { wsManager } from '../../shared/ws/manager';
import { createEvent } from '../../shared/ws/events';

function calcOTHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight OT
  return Math.round((mins / 60) * 100) / 100;
}

export async function listOTRequests(filter: { status?: string; employeeId?: string; page?: number; limit?: number }) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [isNull(employees.deletedAt)];
  if (filter.status) conditions.push(eq(otRequests.status, filter.status as 'pending' | 'approved' | 'rejected'));
  if (filter.employeeId) conditions.push(eq(otRequests.employeeId, filter.employeeId));

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ ot: otRequests, employeeName: employees.name, employeeDepartment: employees.department })
      .from(otRequests)
      .leftJoin(employees, eq(otRequests.employeeId, employees.id))
      .where(where)
      .orderBy(desc(otRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() })
      .from(otRequests)
      .leftJoin(employees, eq(otRequests.employeeId, employees.id))
      .where(where),
  ]);

  return {
    data: rows.map(({ ot, employeeName, employeeDepartment }) => ({ ...ot, employeeName, employeeDepartment })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function submitOTRequest(employeeId: string, data: {
  date: string; startTime: string; endTime: string; reason: string;
}) {
  const id = `ot_${crypto.randomUUID()}`;
  await db.insert(otRequests).values({ id, employeeId, status: 'pending', ...data });
  const [row] = await db.select().from(otRequests).where(eq(otRequests.id, id)).limit(1);

  const [emp] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  wsManager.broadcast(createEvent('OT_REQUEST', employeeId, emp?.name ?? employeeId, {
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
  }));

  return row;
}

export async function updateOTStatus(id: string, status: 'approved' | 'rejected') {
  const [otReq] = await db
    .select({ employeeId: otRequests.employeeId, date: otRequests.date, startTime: otRequests.startTime, endTime: otRequests.endTime })
    .from(otRequests).where(eq(otRequests.id, id)).limit(1);
  if (!otReq) throw notFound('OT request not found');

  await db.update(otRequests).set({ status, updatedAt: new Date() }).where(eq(otRequests.id, id));

  // When approved: sync otHours into attendance_logs for that employee+date
  if (status === 'approved') {
    const approvedOtHours = calcOTHours(otReq.startTime, otReq.endTime);
    const [log] = await db
      .select({ id: attendanceLogs.id, otHours: attendanceLogs.otHours })
      .from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, otReq.employeeId), eq(attendanceLogs.date, otReq.date)))
      .limit(1);
    if (log) {
      // Use the higher of auto-calculated vs approved hours (in case employee already worked OT)
      const newOtHours = Math.max(log.otHours, approvedOtHours);
      await db.update(attendanceLogs).set({ otHours: newOtHours, updatedAt: new Date() }).where(eq(attendanceLogs.id, log.id));
    }
    // If no attendance log exists (pre-approved future OT), nothing to update yet —
    // the hours will be captured at checkout time automatically.
  }

  const [emp] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, otReq.employeeId)).limit(1);
  wsManager.broadcast(createEvent(
    status === 'approved' ? 'OT_APPROVED' : 'OT_REJECTED',
    otReq.employeeId,
    emp?.name ?? otReq.employeeId,
    { status }
  ));

  const [updated] = await db.select().from(otRequests).where(eq(otRequests.id, id)).limit(1);
  return updated;
}
