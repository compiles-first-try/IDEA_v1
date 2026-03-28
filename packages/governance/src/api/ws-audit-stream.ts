/**
 * WebSocket audit event streaming (bidirectional).
 *
 * Server → Client: audit events via PostgreSQL LISTEN/NOTIFY
 * Client → Server: clarification responses during builds
 */
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import pg from "pg";
import type { CacheClient, DbClient } from "@rsf/foundation";

interface AuditStreamDeps {
  httpServer: Server;
  postgresUrl: string;
  cache?: CacheClient;
  db?: DbClient;
}

/**
 * Attach a bidirectional WebSocket server at /audit-stream.
 * Broadcasts audit events and accepts clarification responses.
 */
export function attachAuditStream(deps: AuditStreamDeps): WebSocketServer {
  const { httpServer, postgresUrl, cache, db } = deps;

  const wss = new WebSocketServer({ server: httpServer, path: "/audit-stream" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));

    // Handle incoming messages from clients (clarification responses)
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          buildId?: string;
          payload?: Record<string, unknown>;
        };

        if (msg.type === "clarification_response" && msg.buildId && msg.payload && cache) {
          // Store the answers in Redis for the build endpoint to pick up
          cache.setJson(`rsf:clarification:${msg.buildId}:response`, msg.payload, 300)
            .catch(() => {}); // TTL 5 minutes
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  // Set up PostgreSQL LISTEN for new audit events
  const setupListener = async () => {
    const listener = new pg.Client({ connectionString: postgresUrl });
    await listener.connect();

    // Create the notify trigger — sends only event_id to stay under 8KB NOTIFY limit
    await listener.query(`
      CREATE OR REPLACE FUNCTION notify_audit_event()
      RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('new_audit_event', NEW.event_id::text);
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

    listener.on("notification", async (msg) => {
      if (msg.channel === "new_audit_event" && msg.payload && db) {
        try {
          // Query the full event by ID (NOTIFY only sends the event_id to stay under 8KB limit)
          const eventId = msg.payload;
          const result = await db.query(
            `SELECT event_id, timestamp, agent_id, agent_type, action_type, phase,
                    session_id, inputs, outputs, model_used, tokens_in, tokens_out,
                    cost_usd, duration_ms, status, error_message, reasoning_trace
             FROM agent_events WHERE event_id = $1`,
            [eventId],
          );
          if (result.rows.length === 0) return;

          const data = JSON.stringify({ type: "audit_event", data: result.rows[0] });
          for (const client of clients) {
            if (client.readyState === 1) {
              client.send(data);
            }
          }
        } catch {
          // Query failed — skip this event
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
