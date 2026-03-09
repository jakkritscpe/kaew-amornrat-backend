import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { workLocations } from '../../db/schema';

export async function listLocations() {
  return db.select().from(workLocations);
}

export async function getLocation(id: string) {
  const [row] = await db.select().from(workLocations).where(eq(workLocations.id, id)).limit(1);
  if (!row) throw Object.assign(new Error('Location not found'), { status: 404 });
  return row;
}

export async function createLocation(data: { name: string; lat: number; lng: number; radiusMeters: number }) {
  const id = `loc_${Date.now()}`;
  await db.insert(workLocations).values({ id, ...data });
  return getLocation(id);
}

export async function updateLocation(id: string, data: Partial<{ name: string; lat: number; lng: number; radiusMeters: number }>) {
  await db.update(workLocations).set({ ...data, updatedAt: new Date() }).where(eq(workLocations.id, id));
  return getLocation(id);
}

export async function removeLocation(id: string) {
  await db.delete(workLocations).where(eq(workLocations.id, id));
}
