import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { wsManager } from '../../shared/ws/manager';
import { verifyJWT } from '../../shared/middleware/auth';

const { upgradeWebSocket, websocket } = createBunWebSocket();

// Track pending (unauthenticated) connections: raw WS → timeout handle
const pendingAuth = new Map<unknown, ReturnType<typeof setTimeout>>();

const wsRouter = new Hono();

wsRouter.get(
  '/',
  upgradeWebSocket(() => {
    return {
      onOpen(_evt, ws) {
        // Give client 5 s to send {"type":"auth","token":"<JWT>"}
        const timer = setTimeout(() => {
          ws.close(1008, 'Auth timeout');
        }, 5000);
        pendingAuth.set(ws.raw, timer);
      },

      async onMessage(evt, ws) {
        // -- Unauthenticated: expect auth message first --
        if (pendingAuth.has(ws.raw)) {
          try {
            const msg = JSON.parse(evt.data as string) as { type?: string; token?: string };
            if (msg.type !== 'auth' || !msg.token) {
              ws.close(1008, 'Expected auth message');
              return;
            }

            const payload = await verifyJWT(msg.token, process.env.JWT_SECRET!);
            if (payload.role !== 'admin' && payload.role !== 'manager') {
              ws.close(1008, 'Unauthorized');
              return;
            }

            const timer = pendingAuth.get(ws.raw);
            if (timer) clearTimeout(timer);
            pendingAuth.delete(ws.raw);

            wsManager.add({
              ws: ws.raw as Parameters<typeof wsManager.add>[0]['ws'],
              employeeId: payload.sub,
              role: payload.role,
            });

            ws.send(JSON.stringify({ type: 'auth_ok' }));
          } catch {
            ws.close(1008, 'Auth failed');
          }
          return;
        }

        // -- Authenticated: handle keepalive --
        if (evt.data === 'ping') ws.send('pong');
      },

      onClose(_evt, ws) {
        const timer = pendingAuth.get(ws.raw);
        if (timer) clearTimeout(timer);
        pendingAuth.delete(ws.raw);
        wsManager.remove(ws.raw as Parameters<typeof wsManager.remove>[0]);
      },

      onError(_evt, ws) {
        const timer = pendingAuth.get(ws.raw);
        if (timer) clearTimeout(timer);
        pendingAuth.delete(ws.raw);
        wsManager.remove(ws.raw as Parameters<typeof wsManager.remove>[0]);
      },
    };
  })
);

export { websocket };
export default wsRouter;
