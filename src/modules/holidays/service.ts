import { eq, and, gte, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import { holidays } from '../../db/schema';
import { notFound } from '../../shared/utils/errors';

export async function listHolidays(year?: number) {
  if (year) {
    const yearStr = year.toString();
    const rows = await db
      .select()
      .from(holidays)
      .where(
        or(
          // exact year match
          and(gte(holidays.date, `${yearStr}-01-01`), lte(holidays.date, `${yearStr}-12-31`)),
          // recurring holidays apply every year — client filters by month/day
          eq(holidays.isRecurring, true)
        )
      )
      .orderBy(holidays.date);
    return rows;
  }
  return db.select().from(holidays).orderBy(holidays.date);
}

export async function createHoliday(data: {
  date: string; name: string; description?: string; isRecurring?: boolean;
}) {
  const id = `hol_${crypto.randomUUID()}`;
  await db.insert(holidays).values({ id, ...data, isRecurring: data.isRecurring ?? false });
  const [row] = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
  return row;
}

export async function updateHoliday(id: string, data: {
  date?: string; name?: string; description?: string; isRecurring?: boolean;
}) {
  const [existing] = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
  if (!existing) throw notFound('Holiday not found');
  await db.update(holidays).set({ ...data, updatedAt: new Date() }).where(eq(holidays.id, id));
  const [row] = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
  return row;
}

export async function deleteHoliday(id: string) {
  const [existing] = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
  if (!existing) throw notFound('Holiday not found');
  await db.delete(holidays).where(eq(holidays.id, id));
}
