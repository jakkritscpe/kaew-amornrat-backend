import { createApp, websocket } from './app';

// Validate required environment variables before starting
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  console.error('[startup] JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

const app = createApp();
const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

console.log(`[startup] Server running on port ${port}`);

async function shutdown(signal: string) {
  console.log(`[shutdown] Received ${signal}, stopping server...`);
  await server.stop(true);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
