import { db } from './index';
import { employees, workLocations, companySettings } from './schema';
import { eq, isNull } from 'drizzle-orm';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function seed() {
  console.log('Seeding database...');

  // Locations
  await db.insert(workLocations).values([
    { id: 'loc_1', name: 'สำนักงานใหญ่ กรุงเทพ', lat: 13.7563, lng: 100.5018, radiusMeters: 300 },
    { id: 'loc_2', name: 'คลังสินค้า A', lat: 13.7650, lng: 100.5380, radiusMeters: 200 },
  ]).onConflictDoNothing();

  // Employees
  const adminHash = await hashPassword('admin1234');
  const empHash = await hashPassword('emp1234');

  await db.insert(employees).values([
    {
      id: 'emp_admin',
      name: 'ผู้ดูแลระบบ',
      email: 'admin@repair-hub.local',
      passwordHash: adminHash,
      department: 'IT',
      position: 'System Administrator',
      role: 'admin',
      shiftStartTime: '08:00:00',
      shiftEndTime: '17:00:00',
      locationId: 'loc_1',
      baseWage: '50000',
      otRateUseDefault: true,
    },
    {
      id: 'emp_001',
      name: 'สมชาย ใจดี',
      nickname: 'ชาย',
      email: 'somchai@repair-hub.local',
      passwordHash: empHash,
      department: 'ช่างเทคนิค',
      position: 'ช่างเทคนิคอาวุโส',
      role: 'employee',
      shiftStartTime: '08:00:00',
      shiftEndTime: '17:00:00',
      locationId: 'loc_1',
      baseWage: '25000',
      otRateUseDefault: true,
    },
    {
      id: 'emp_002',
      name: 'วิศวะ เก่งมาก',
      nickname: 'วิศ',
      email: 'wisawa@repair-hub.local',
      passwordHash: empHash,
      department: 'ช่างเทคนิค',
      position: 'ช่างเทคนิค',
      role: 'employee',
      shiftStartTime: '08:00:00',
      shiftEndTime: '17:00:00',
      locationId: 'loc_2',
      baseWage: '20000',
      otRateUseDefault: false,
      otRateType: 'multiplier',
      otRateValue: 1.5,
    },
    {
      id: 'emp_manager',
      name: 'ผู้จัดการ สมศรี',
      email: 'manager@repair-hub.local',
      passwordHash: adminHash,
      department: 'บริหาร',
      position: 'ผู้จัดการ',
      role: 'manager',
      shiftStartTime: '08:00:00',
      shiftEndTime: '17:00:00',
      locationId: 'loc_1',
      baseWage: '40000',
      otRateUseDefault: true,
    },
  ]).onConflictDoNothing();

  // Company Settings
  await db.insert(companySettings).values({
    id: 'default',
    defaultOtRateType: 'multiplier',
    defaultOtRateValue: 1.5,
  }).onConflictDoNothing();

  // Update qrTokens for employees that don't have one
  const empsWithoutQR = await db.select({ id: employees.id }).from(employees).where(isNull(employees.qrToken));
  for (const emp of empsWithoutQR) {
    await db.update(employees).set({ qrToken: crypto.randomUUID() }).where(eq(employees.id, emp.id));
  }
  console.log(`Updated QR tokens for ${empsWithoutQR.length} employees`);

  console.log('Seed complete');
  console.log('');
  console.log('Test accounts:');
  console.log('  Admin:    admin@repair-hub.local / admin1234');
  console.log('  Manager:  manager@repair-hub.local / admin1234');
  console.log('  Employee: somchai@repair-hub.local / emp1234');
  console.log('  Employee: wisawa@repair-hub.local / emp1234');

  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
