import { createApp, websocket } from './app';

const app = createApp();
const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

console.log(`🚀 Server running on http://localhost:${port}`);
