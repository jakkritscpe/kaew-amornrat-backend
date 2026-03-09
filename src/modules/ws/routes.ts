import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { wsManager } from '../../shared/ws/manager';
import { verifyJWT } from '../../shared/middleware/auth';

const { upgradeWebSocket, websocket } = createBunWebSocket();

const wsRouter = new Hono();

wsRouter.get(
  '/',
  upgradeWebSocket(async (c) => {
    const token = c.req.query('token');

    let payload: { sub: string; name: string; role: string } | null = null;
    if (token) {
      try {
        payload = await verifyJWT(token, process.env.JWT_SECRET ?? 'secret') as typeof payload;
      } catch {
        // invalid token - will be rejected in onOpen
      }
    }

    return {
      onOpen(_evt, ws) {
        if (!payload || (payload.role !== 'admin' && payload.role !== 'manager')) {
          ws.close(1008, 'Unauthorized');
          return;
        }
        wsManager.add({
          ws: ws.raw as Parameters<typeof wsManager.add>[0]['ws'],
          employeeId: payload.sub,
          role: payload.role,
        });
      },
      onMessage(evt, ws) {
        // ping/pong keepalive
        if (evt.data === 'ping') {
          ws.send('pong');
        }
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
