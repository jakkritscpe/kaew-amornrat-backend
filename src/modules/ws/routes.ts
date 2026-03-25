import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { wsManager } from '../../shared/ws/manager';
import { authMiddleware, guardRole, verifyJWT } from '../../shared/middleware/auth';
import { fail } from '../../shared/utils/response';
import type { JWTPayload } from '../../shared/types';

const { upgradeWebSocket, websocket } = createBunWebSocket();

const wsRouter = new Hono();

// Middleware: accept auth via HttpOnly cookie (same-origin) OR ?token= query param (cross-domain).
// The ?token= path is used when frontend (Vercel) and backend (Render) are on different domains
// so the browser cannot send the HttpOnly cookie on the WS upgrade request.
async function wsAuthMiddleware(c: Parameters<typeof authMiddleware>[0], next: Parameters<typeof authMiddleware>[1]) {
  const queryToken = c.req.query('token');
  if (queryToken) {
    try {
      const payload = await verifyJWT(queryToken, process.env.JWT_SECRET!);
      c.set('jwtPayload', payload);
      return next();
    } catch {
      return c.json(fail('Invalid or expired WS token'), 401);
    }
  }
  // Fallback: cookie-based auth (local dev / same-origin)
  return authMiddleware(c, next);
}

wsRouter.get(
  '/',
  wsAuthMiddleware,
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
