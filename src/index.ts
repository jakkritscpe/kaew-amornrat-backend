import { createApp, websocket } from './app';

// Validate required environment variables before starting
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = createApp();
const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

console.log(`🚀 Server running on http://localhost:${port}`);
