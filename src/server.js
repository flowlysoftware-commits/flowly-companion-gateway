import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { SessionManager } from "./sessionManager.js";
import { safeJsonParse, send, sendError } from "./protocol.js";

const PORT = Number(process.env.PORT || 3001);
const FLOWLY_API_URL = process.env.FLOWLY_API_URL || "https://flowlyia.com";

const app = express();
const server = http.createServer(app);
const sessions = new SessionManager();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Flowly Companion Gateway",
    version: "1.0.0"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Flowly Companion Gateway",
    generatedAt: new Date().toISOString(),
    flowlyApiUrl: FLOWLY_API_URL,
    activeSessions: sessions.count()
  });
});

app.get("/sessions", (_req, res) => {
  res.json({
    ok: true,
    activeSessions: sessions.count(),
    sessions: sessions.listSafe()
  });
});

const wss = new WebSocketServer({
  server,
  path: "/flow-companion"
});

wss.on("connection", (socket, request) => {
  const session = sessions.createSession(socket);

  console.log(`[Gateway] Connected: ${session.sessionId} from ${request.socket.remoteAddress}`);

  send(socket, "gateway.connected", {
    sessionId: session.sessionId,
    message: "Flow Companion Gateway connected",
    commands: [
      { type: "hello" },
      { type: "message" },
      { type: "heartbeat" },
      { type: "state.update" },
      { type: "ping" },
      { type: "thinking" },
      { type: "speaking" },
      { type: "finished" }
    ]
  });

  socket.on("message", async (rawBuffer) => {
    const raw = rawBuffer.toString("utf8");
    const payload = safeJsonParse(raw);

    if (!payload) {
      sendError(socket, "Invalid JSON", { raw });
      return;
    }

    sessions.touch(session);
    sessions.addMessage(session, {
      direction: "in",
      payload
    });

    console.log(`[Gateway] <<< ${session.sessionId}`, payload);

    switch (payload.type) {
      case "hello": {
        sessions.updateIdentity(session, payload);

        send(socket, "hello.accepted", {
          sessionId: session.sessionId,
          companionId: session.companionId,
          userId: session.userId,
          companionName: session.companionName,
          state: "ready"
        });
        break;
      }

      case "message": {
        session.state = "thinking";
        send(socket, "companion.thinking", {
          sessionId: session.sessionId,
          text: payload.text || ""
        });

        setTimeout(() => {
          session.state = "speaking";
          send(socket, "companion.response.started", {
            sessionId: session.sessionId
          });

          send(socket, "companion.message", {
            sessionId: session.sessionId,
            text: `He recibido tu mensaje: ${payload.text || ""}`,
            emotion: "friendly"
          });

          session.state = "idle";
          send(socket, "companion.response.finished", {
            sessionId: session.sessionId,
            state: "idle"
          });
        }, 500);
        break;
      }

case "heartbeat": {
  sessions.touch(session);
  send(socket, "heartbeat.ok", {
    sessionId: session.sessionId,
    serverTime: new Date().toISOString(),
    state: session.state
  });
  break;
}

case "ping": {
  send(socket, "pong", {
    sessionId: session.sessionId
  });
  break;
}

      case "thinking": {
        session.state = "thinking";
        send(socket, "companion.thinking", {
          sessionId: session.sessionId
        });
        break;
      }

      case "speaking": {
        session.state = "speaking";
        send(socket, "companion.response.started", {
          sessionId: session.sessionId
        });
        break;
      }

      case "finished": {
        const event = sessions.setState(session, "idle");

        send(socket, "companion.response.finished", {
          sessionId: session.sessionId,
          state: session.state,
          lastActivity: session.lastActivity,
          generatedAt: event.generatedAt
        });
        break;
      }

      case "state.update": {
        const event = sessions.setState(session, payload.state);

        if (!event) {
          sendError(socket, "Invalid session state", {
            sessionId: session.sessionId,
            receivedState: payload.state
          });
          break;
        }

        send(socket, "session.state.changed", {
          sessionId: session.sessionId,
          previousState: event.previousState,
          state: session.state,
          lastActivity: session.lastActivity,
          stateChangedAt: session.stateChangedAt,
          generatedAt: event.generatedAt
        });

        break;
      }

      default: {
        send(socket, "gateway.event.received", {
          sessionId: session.sessionId,
          receivedType: payload.type || "unknown"
        });
      }
    }
  });

  socket.on("close", (code, reason) => {
    console.log(`[Gateway] Disconnected: ${session.sessionId}. Code: ${code}. Reason: ${reason}`);
    sessions.removeSession(session.sessionId);
  });

  socket.on("error", (error) => {
    console.error(`[Gateway] Socket error: ${session.sessionId}`, error);
  });
});

server.listen(PORT, () => {
  console.log(`[Gateway] Flowly Companion Gateway running on port ${PORT}`);
  console.log(`[Gateway] Health: http://localhost:${PORT}/health`);
  console.log(`[Gateway] WebSocket: ws://localhost:${PORT}/flow-companion`);
});
