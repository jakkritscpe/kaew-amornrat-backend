import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { companySettings } from '../../db/schema';

export async function getSettings() {
  const [row] = await db.select().from(companySettings).where(eq(companySettings.id, 'default')).limit(1);
  if (!row) {
    await db.insert(companySettings).values({ id: 'default', defaultOtRateType: 'multiplier', defaultOtRateValue: 1.5 });
    return getSettings();
  }
  return row;
}

export async function updateSettings(data: { defaultOtRateType?: 'multiplier' | 'fixed'; defaultOtRateValue?: number }) {
  await db
    .insert(companySettings)
    .values({ id: 'default', defaultOtRateType: data.defaultOtRateType ?? 'multiplier', defaultOtRateValue: data.defaultOtRateValue ?? 1.5 })
    .onConflictDoUpdate({ target: companySettings.id, set: { ...data, updatedAt: new Date() } });
  return getSettings();
}
