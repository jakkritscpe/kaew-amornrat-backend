import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('✅ Migrations complete');

// Safety net: ensure tables added after initial manual DB setup are present.
// Drizzle migration tracking may be empty on this DB (schema was applied manually),
// so we use CREATE TABLE IF NOT EXISTS as a guaranteed fallback.
await client`
  CREATE TABLE IF NOT EXISTS holidays (
    id text PRIMARY KEY NOT NULL,
    date date NOT NULL,
    name varchar(255) NOT NULL,
    description text,
    is_recurring boolean DEFAULT false NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
  )
`;
await client`CREATE INDEX IF NOT EXISTS holidays_date_idx ON holidays (date)`;
console.log('✅ Schema safety checks complete');

await client.end();
