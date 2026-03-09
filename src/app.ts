import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './shared/middleware/error-handler';
import authRoutes from './modules/auth/routes';
import employeesRoutes from './modules/employees/routes';
import locationsRoutes from './modules/locations/routes';
import attendanceRoutes from './modules/attendance/routes';
import otRoutes from './modules/ot-requests/routes';
import settingsRoutes from './modules/settings/routes';
import qrRoutes from './modules/qr-checkin/routes';
import wsRouter, { websocket } from './modules/ws/routes';

export interface Variables {
  jwtPayload: {
    sub: string;
    name: string;
    role: 'admin' | 'manager' | 'employee';
    email: string;
  };
}

export function createApp() {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', logger());
  app.use('*', cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }));

  app.onError(errorHandler);
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.route('/api/auth', authRoutes);
  app.route('/api/employees', employeesRoutes);
  app.route('/api/locations', locationsRoutes);
  app.route('/api/attendance', attendanceRoutes);
  app.route('/api/ot-requests', otRoutes);
  app.route('/api/settings', settingsRoutes);
  app.route('/api/qr-checkin', qrRoutes);
  app.route('/ws', wsRouter);

  return app;
}

export { websocket };
