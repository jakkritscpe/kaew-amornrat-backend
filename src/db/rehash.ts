/**
 * One-time script: upgrade existing SHA-256 password hashes to bcrypt.
 * Run with: bun run src/db/rehash.ts
 */
import { db } from './index';
import { employees } from './schema';
import { eq } from 'drizzle-orm';

const updates: Array<{ id: string; password: string }> = [
  { id: 'emp_admin', password: 'admin1234' },
  { id: 'emp_manager', password: 'admin1234' },
  { id: 'emp_001', password: 'emp1234' },
  { id: 'emp_002', password: 'emp1234' },
];

for (const { id, password } of updates) {
  const hash = await Bun.password.hash(password);
  await db.update(employees).set({ passwordHash: hash }).where(eq(employees.id, id));
  console.log(`Updated ${id}`);
}

console.log('Done — all seed accounts now use bcrypt hashes.');
process.exit(0);
