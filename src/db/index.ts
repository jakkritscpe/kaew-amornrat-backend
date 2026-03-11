import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const isProduction = process.env.NODE_ENV === 'production';
const requireSsl =
  isProduction ||
  connectionString.includes('sslmode=require') ||
  connectionString.includes('supabase') ||
  connectionString.includes('render');

const client = postgres(connectionString, {
  ssl: requireSsl ? 'require' : false,
  max: 10,
});
export const db = drizzle(client, { schema });
export type DB = typeof db;
