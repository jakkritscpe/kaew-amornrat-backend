import dns from 'dns';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Force IPv4 to avoid ECONNREFUSED on IPv6 (Render → Supabase)
dns.setDefaultResultOrder('ipv4first');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, {
  ssl: connectionString.includes('supabase') || connectionString.includes('render') ? 'require' : false,
  max: 10,
});
export const db = drizzle(client, { schema });
export type DB = typeof db;
