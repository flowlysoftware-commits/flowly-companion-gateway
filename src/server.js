import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { SessionManager } from "./sessionManager.js";
import { safeJsonParse, send, sendError } from "./protocol.js";
import { fetchCompanionProfile } from "./flowlyClient.js";
import { getOpenAIEngineSnapshot } from "./engines/openaiEngine.js";
import { processConversationTurn } from "./engines/conversationEngine.js";

const PORT = Number(process.env.PORT || 3001);
const FLOWLY_API_URL = process.env.FLOWLY_API_URL || "https://flowlyia.com";

console.log("===== OPENAI =====");
console.log(process.env.OPENAI_API_KEY ? "✅ OPENAI_API_KEY cargada." : "❌ OPENAI_API_KEY NO encontrada.");
console.log("==================");

const app = express();
const server = http.createServer(app);
const sessions = new SessionManager();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Flowly Companion Gateway",
    version: "2.0.0"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Flowly Companion Gateway",
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    flowlyApiUrl: FLOWLY_API_URL,
    activeSessions: sessions.count(),
    modules: getModulesStatus()
  });
});

app.get("/runtime/modules", (_req, res) => {
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    modules: getModulesStatus()
  });
});

app.get("/openai/status", (_req, res) => {
  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    openai: getOpenAIEngineSnapshot(null)
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
    version: "2.0.0",
    modules: getModulesStatus(),
    commands: [
      { type: "hello" },
      { type: "message" },
      { type: "heartbeat" },
      { type: "state.update" },
      { type: "runtime.snapshot" },
      { type: "runtime.context" },
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
        await handleHello(socket, session, payload);
        break;
      }

      case "message": {
        await handleMessage(socket, session, payload);
        break;
      }

      case "heartbeat": {
        sessions.touch(session);
        send(socket, "heartbeat.ok", {
          sessionId: session.sessionId,
          serverTime: new Date().toISOString(),
          state: session.state,
          runtime: sessions.getRuntimeSnapshot(session)
        });
        break;
      }

      case "ping": {
        send(socket, "pong", {
          sessionId: session.sessionId,
          runtime: sessions.getRuntimeSnapshot(session)
        });
        break;
      }

      case "thinking": {
        handleStateUpdate(socket, session, "thinking");
        break;
      }

      case "speaking": {
        handleStateUpdate(socket, session, "speaking");
        send(socket, "companion.response.started", {
          sessionId: session.sessionId,
          runtime: sessions.getRuntimeSnapshot(session)
        });
        break;
      }

      case "finished": {
        handleStateUpdate(socket, session, "idle");
        send(socket, "companion.response.finished", {
          sessionId: session.sessionId,
          state: session.state,
          runtime: sessions.getRuntimeSnapshot(session)
        });
        break;
      }

      case "state.update": {
        handleStateUpdate(socket, session, payload.state);
        break;
      }

      case "runtime.snapshot": {
        send(socket, "runtime.snapshot", {
          sessionId: session.sessionId,
          runtime: sessions.getRuntimeSnapshot(session)
        });
        break;
      }

      case "runtime.context": {
        send(socket, "runtime.context", {
          sessionId: session.sessionId,
          context: session.runtime?.context || null,
          runtime: sessions.getRuntimeSnapshot(session)
        });
        break;
      }

      default: {
        send(socket, "gateway.event.received", {
          sessionId: session.sessionId,
          receivedType: payload.type || "unknown",
          runtime: sessions.getRuntimeSnapshot(session)
        });
      }
    }
  });

  socket.on("close", (code, reason) => {
    console.log(`[Gateway] Disconnected: ${session.sessionId}. Code: ${code}. Reason: ${reason}`);
    sessions.setState(session, "disconnected");
    sessions.removeSession(session.sessionId);
  });

  socket.on("error", (error) => {
    console.error(`[Gateway] Socket error: ${session.sessionId}`, error);
  });
});

async function handleHello(socket, session, payload) {
  sessions.updateIdentity(session, payload);

  const profileResult = await fetchCompanionProfile({
    flowlyApiUrl: FLOWLY_API_URL,
    companionId: session.companionId,
    userId: session.userId
  });

  if (profileResult.ok && profileResult.companion) {
    sessions.setProfile(session, profileResult.companion);

    send(socket, "companion.profile.loaded", {
      sessionId: session.sessionId,
      companion: session.profile
    });

    send(socket, "runtime.ready", {
      sessionId: session.sessionId,
      runtime: sessions.getRuntimeSnapshot(session)
    });
  } else {
    send(socket, "companion.profile.fallback", {
      sessionId: session.sessionId,
      message: "Flowly profile could not be loaded. Using local fallback profile.",
      error: profileResult.error || "unknown",
      runtime: sessions.getRuntimeSnapshot(session)
    });
  }

  send(socket, "hello.accepted", {
    sessionId: session.sessionId,
    companionId: session.companionId,
    userId: session.userId,
    companionName: session.companionName,
    state: "ready",
    profileLoaded: Boolean(session.profile),
    runtime: sessions.getRuntimeSnapshot(session)
  });
}

async function handleMessage(socket, session, payload) {
  const userText = String(payload.text || "").trim();

  const thinkingEvent = sessions.setState(session, "thinking");
  sendStateChanged(socket, session, thinkingEvent);

  send(socket, "companion.thinking", {
    sessionId: session.sessionId,
    text: userText,
    runtime: sessions.getRuntimeSnapshot(session)
  });

  send(socket, "conversation.context.building", {
    sessionId: session.sessionId,
    runtime: sessions.getRuntimeSnapshot(session)
  });

  const startedAt = Date.now();
  const conversationResult = await processConversationTurn({
    session,
    sessions,
    userText,
    source: "unity"
  });

  send(socket, "conversation.context.ready", {
    sessionId: session.sessionId,
    memoryCount: conversationResult?.context?.memories?.length || 0,
    memoriesStored: conversationResult?.memoriesStored || [],
    openai: conversationResult?.openai || null,
    runtime: sessions.getRuntimeSnapshot(session)
  });

  if (conversationResult?.memoriesStored?.length > 0) {
    send(socket, "memory.stored", {
      sessionId: session.sessionId,
      memories: conversationResult.memoriesStored,
      runtime: sessions.getRuntimeSnapshot(session)
    });
  }

  const speakingEvent = sessions.setState(session, "speaking");
  sendStateChanged(socket, session, speakingEvent);

  send(socket, "companion.response.started", {
    sessionId: session.sessionId,
    openai: conversationResult?.openai || null,
    runtime: sessions.getRuntimeSnapshot(session)
  });

  send(socket, "companion.message", {
    sessionId: session.sessionId,
    text: conversationResult?.text || "Estoy aquí contigo.",
    emotion: conversationResult?.emotion || session.runtime?.emotion?.mood || "neutral",
    memoriesStored: conversationResult?.memoriesStored || [],
    openai: conversationResult?.openai || null,
    latencyMs: Date.now() - startedAt,
    actions: session.runtime?.actions || [],
    runtime: sessions.getRuntimeSnapshot(session)
  });

  const idleEvent = sessions.setState(session, "idle");
  sendStateChanged(socket, session, idleEvent);

  send(socket, "companion.response.finished", {
    sessionId: session.sessionId,
    state: session.state,
    latencyMs: Date.now() - startedAt,
    runtime: sessions.getRuntimeSnapshot(session)
  });
}

function handleStateUpdate(socket, session, state) {
  const event = sessions.setState(session, state);

  if (!event) {
    sendError(socket, "Invalid session state", {
      sessionId: session.sessionId,
      receivedState: state
    });
    return;
  }

  sendStateChanged(socket, session, event);
}

function sendStateChanged(socket, session, event) {
  if (!event) return;

  send(socket, "session.state.changed", {
    sessionId: session.sessionId,
    previousState: event.previousState,
    state: session.state,
    lastActivity: session.lastActivity,
    stateChangedAt: session.stateChangedAt,
    generatedAt: event.generatedAt,
    runtime: sessions.getRuntimeSnapshot(session)
  });
}

function getModulesStatus() {
  return {
    runtime: "enabled",
    profile: "enabled",
    context: "enabled",
    memory: "enabled-local",
    emotion: "enabled-local",
    personality: "enabled",
    voice: "configured",
    actions: "enabled",
    openai: getOpenAIEngineSnapshot(null)
  };
}

server.listen(PORT, () => {
  console.log(`[Gateway] Flowly Companion Gateway running on port ${PORT}`);
  console.log(`[Gateway] Health: http://localhost:${PORT}/health`);
  console.log(`[Gateway] WebSocket: ws://localhost:${PORT}/flow-companion`);
});
