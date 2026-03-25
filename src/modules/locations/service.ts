import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../../db';
import { workLocations } from '../../db/schema';
import { notFound } from '../../shared/utils/errors';

const publicFields = {
  id: workLocations.id,
  name: workLocations.name,
  lat: workLocations.lat,
  lng: workLocations.lng,
  radiusMeters: workLocations.radiusMeters,
  createdAt: workLocations.createdAt,
  updatedAt: workLocations.updatedAt,
};

export async function listLocations() {
  return db.select(publicFields).from(workLocations).where(and(isNull(workLocations.deletedAt)));
}

export async function getLocation(id: string) {
  const [row] = await db.select().from(workLocations).where(eq(workLocations.id, id)).limit(1);
  if (!row || row.deletedAt) throw notFound('Location not found');
  const { deletedAt: _, ...rest } = row;
  return rest;
}

export async function createLocation(data: { name: string; lat: number; lng: number; radiusMeters: number }) {
  const id = `loc_${crypto.randomUUID()}`;
  await db.insert(workLocations).values({ id, ...data });
  return getLocation(id);
}

export async function updateLocation(id: string, data: Partial<{ name: string; lat: number; lng: number; radiusMeters: number }>) {
  await getLocation(id); // throws 404 if not found or soft-deleted
  await db.update(workLocations).set({ ...data, updatedAt: new Date() }).where(eq(workLocations.id, id));
  return getLocation(id);
}

export async function removeLocation(id: string) {
  await db.update(workLocations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(workLocations.id, id));
}
