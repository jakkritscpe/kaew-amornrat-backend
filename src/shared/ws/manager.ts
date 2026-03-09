import type { ServerWebSocket } from 'bun';
import type { NotificationEvent } from './events';

interface AdminConnection {
  ws: ServerWebSocket<unknown>;
  employeeId: string;
  role: string;
}

class WSManager {
  private connections = new Set<AdminConnection>();

  add(conn: AdminConnection) {
    this.connections.add(conn);
    console.log(`[WS] Admin connected: ${conn.employeeId} (total: ${this.connections.size})`);
  }

  remove(ws: ServerWebSocket<unknown>) {
    for (const conn of this.connections) {
      if (conn.ws === ws) {
        this.connections.delete(conn);
        console.log(`[WS] Admin disconnected: ${conn.employeeId} (total: ${this.connections.size})`);
        break;
      }
    }
  }

  broadcast(event: NotificationEvent) {
    const message = JSON.stringify(event);
    let sent = 0;
    for (const conn of this.connections) {
      if (conn.role === 'admin' || conn.role === 'manager') {
        try {
          conn.ws.send(message);
          sent++;
        } catch {
          this.connections.delete(conn);
        }
      }
    }
    console.log(`[WS] Broadcast ${event.type} to ${sent} admin(s)`);
  }

  count() {
    return this.connections.size;
  }
}

// Singleton
export const wsManager = new WSManager();
