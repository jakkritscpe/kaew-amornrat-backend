import { eq, and, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { otRequests, employees } from '../../db/schema';

export async function listOTRequests(filter: { status?: string; employeeId?: string }) {
  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(otRequests.status, filter.status as 'pending' | 'approved' | 'rejected'));
  if (filter.employeeId) conditions.push(eq(otRequests.employeeId, filter.employeeId));

  const rows = await db
    .select({ ot: otRequests, employeeName: employees.name, employeeDepartment: employees.department })
    .from(otRequests)
    .leftJoin(employees, eq(otRequests.employeeId, employees.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(otRequests.createdAt);

  return rows.map(({ ot, employeeName, employeeDepartment }) => ({ ...ot, employeeName, employeeDepartment }));
}

export async function submitOTRequest(employeeId: string, data: {
  date: string; startTime: string; endTime: string; reason: string;
}) {
  const id = `ot_${Date.now()}`;
  await db.insert(otRequests).values({ id, employeeId, status: 'pending', ...data });
  const [row] = await db.select().from(otRequests).where(eq(otRequests.id, id)).limit(1);
  return row;
}

export async function updateOTStatus(id: string, status: 'approved' | 'rejected') {
  await db.update(otRequests).set({ status, updatedAt: new Date() }).where(eq(otRequests.id, id));
}
