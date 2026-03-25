import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { wsManager } from '../../shared/ws/manager';
import { authMiddleware, guardRole } from '../../shared/middleware/auth';
import type { JWTPayload } from '../../shared/types';

const { upgradeWebSocket, websocket } = createBunWebSocket();

const wsRouter = new Hono();

// Auth is verified at HTTP upgrade time via authMiddleware (reads HttpOnly cookie).
// Unauthenticated or low-privilege connections receive a 401/403 HTTP response and
// the upgrade is never established — no need for first-message auth.
wsRouter.get(
  '/',
  authMiddleware,
  guardRole('admin', 'manager'),
  upgradeWebSocket((c) => {
    const payload = c.get('jwtPayload') as JWTPayload;

    return {
      onOpen(_evt, ws) {
        wsManager.add({
          ws: ws.raw as Parameters<typeof wsManager.add>[0]['ws'],
          employeeId: payload.sub,
          role: payload.role,
        });
        // Notify client that auth succeeded (keeps protocol compatibility with frontend)
        ws.send(JSON.stringify({ type: 'auth_ok' }));
      },

      onMessage(evt, ws) {
        if (evt.data === 'ping') ws.send('pong');
      },

      onClose(_evt, ws) {
        wsManager.remove(ws.raw as Parameters<typeof wsManager.remove>[0]);
      },

      onError(_evt, ws) {
        wsManager.remove(ws.raw as Parameters<typeof wsManager.remove>[0]);
      },
    };
  })
);

export { websocket };
export default wsRouter;
