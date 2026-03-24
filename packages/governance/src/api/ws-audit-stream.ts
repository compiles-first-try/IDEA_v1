/**
 * WebSocket audit event streaming.
 *
 * Uses PostgreSQL LISTEN/NOTIFY to broadcast new agent_events
 * to all connected WebSocket clients in real time.
 */
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import pg from "pg";

interface AuditStreamDeps {
  httpServer: Server;
  postgresUrl: string;
}

/**
 * Attach a WebSocket server at /audit-stream that broadcasts
 * new agent_events via PostgreSQL LISTEN/NOTIFY.
 */
export function attachAuditStream(deps: AuditStreamDeps): WebSocketServer {
  const { httpServer, postgresUrl } = deps;

  const wss = new WebSocketServer({ server: httpServer, path: "/audit-stream" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  // Set up PostgreSQL LISTEN for new audit events
  const setupListener = async () => {
    const listener = new pg.Client({ connectionString: postgresUrl });
    await listener.connect();

    // Create the notify trigger if it doesn't exist
    await listener.query(`
      CREATE OR REPLACE FUNCTION notify_audit_event()
      RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('new_audit_event', row_to_json(NEW)::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await listener.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'audit_event_notify'
        ) THEN
          CREATE TRIGGER audit_event_notify
            AFTER INSERT ON agent_events
            FOR EACH ROW EXECUTE FUNCTION notify_audit_event();
        END IF;
      END $$;
    `);

    listener.on("notification", (msg) => {
      if (msg.channel === "new_audit_event" && msg.payload) {
        const data = JSON.stringify({ type: "audit_event", data: JSON.parse(msg.payload) });
        for (const client of clients) {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(data);
          }
        }
      }
    });

    await listener.query("LISTEN new_audit_event");
    console.log("[audit-stream] PostgreSQL LISTEN/NOTIFY active, WebSocket ready");
  };

  setupListener().catch((err) => {
    console.error("[audit-stream] Failed to set up PostgreSQL listener:", err);
  });

  return wss;
}
