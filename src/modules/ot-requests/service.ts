import { eq, and, count, desc, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { otRequests, employees } from '../../db/schema';
import { wsManager } from '../../shared/ws/manager';
import { createEvent } from '../../shared/ws/events';

export async function listOTRequests(filter: { status?: string; employeeId?: string; page?: number; limit?: number }) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(otRequests.status, filter.status as 'pending' | 'approved' | 'rejected'));
  if (filter.employeeId) conditions.push(eq(otRequests.employeeId, filter.employeeId));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ ot: otRequests, employeeName: employees.name, employeeDepartment: employees.department })
      .from(otRequests)
      .leftJoin(employees, eq(otRequests.employeeId, employees.id))
      .where(where)
      .orderBy(desc(otRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(otRequests).where(where),
  ]);

  return {
    data: rows.map(({ ot, employeeName, employeeDepartment }) => ({ ...ot, employeeName, employeeDepartment })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function submitOTRequest(employeeId: string, data: {
  date: string; startTime: string; endTime: string; reason: string;
}) {
  const id = `ot_${Date.now()}`;
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
  await db.update(otRequests).set({ status, updatedAt: new Date() }).where(eq(otRequests.id, id));

  const [otReq] = await db.select({ employeeId: otRequests.employeeId }).from(otRequests).where(eq(otRequests.id, id)).limit(1);
  if (otReq) {
    const [emp] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, otReq.employeeId)).limit(1);
    wsManager.broadcast(createEvent(
      status === 'approved' ? 'OT_APPROVED' : 'OT_REJECTED',
      otReq.employeeId,
      emp?.name ?? otReq.employeeId,
      { status }
    ));
  }
}
