export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(socket, metadata = {}) {
    const sessionId = `flow-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const session = {
      sessionId,
      socket,
      companionId: metadata.companionId || "unknown-companion",
      userId: metadata.userId || "unknown-user",
      companionName: metadata.companionName || "Flow",
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      emotion: "neutral",
      state: "connected",
      messages: []
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  updateIdentity(session, payload = {}) {
    if (!session) return null;

    session.companionId = payload.companionId || session.companionId;
    session.userId = payload.userId || session.userId;
    session.companionName = payload.companionName || session.companionName;
    session.lastActivity = new Date().toISOString();

    return session;
  }

  touch(session) {
    if (!session) return;
    session.lastActivity = new Date().toISOString();
  }

  addMessage(session, message) {
    if (!session) return;

    session.messages.push({
      at: new Date().toISOString(),
      ...message
    });

    if (session.messages.length > 50) {
      session.messages.shift();
    }

    this.touch(session);
  }

  removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  count() {
    return this.sessions.size;
  }

  listSafe() {
    return Array.from(this.sessions.values()).map((session) => ({
      sessionId: session.sessionId,
      companionId: session.companionId,
      userId: session.userId,
      companionName: session.companionName,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      emotion: session.emotion,
      state: session.state,
      messageCount: session.messages.length
    }));
  }
}
