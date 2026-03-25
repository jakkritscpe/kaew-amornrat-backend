import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// Log which migrations are pending before running
const applied = await client`
  SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at
`.catch(() => []);
console.log('[migrate] Applied so far:', applied.map((r: { tag: string }) => r.tag));

await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('✅ Migrations complete');

const appliedAfter = await client`
  SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at
`.catch(() => []);
console.log('[migrate] Applied after:', appliedAfter.map((r: { tag: string }) => r.tag));

await client.end();
