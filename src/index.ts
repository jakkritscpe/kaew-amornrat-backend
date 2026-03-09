import { createApp } from './app';

const app = createApp();
const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
