export function createCompanionRuntime(session) {
  const now = new Date().toISOString();

  return {
    runtimeVersion: "1.0.0",
    sessionId: session.sessionId,
    createdAt: now,
    updatedAt: now,
    state: {
      current: session.state || "connected",
      previous: session.previousState || null,
      changedAt: session.stateChangedAt || now
    },
    profile: {
      loaded: false,
      loadedAt: null,
      companionId: session.companionId || "unknown-companion",
      name: session.companionName || "Flow",
      language: session.language || "es",
      voice: session.voice || "nova",
      model: session.model || "gpt-realtime",
      personality: session.personality || "Empático, natural, atento y cercano",
      memoryEnabled: session.memoryEnabled ?? true,
      emotionEnabled: session.emotionEnabled ?? true
    },
    emotion: {
      mood: session.emotion || "neutral",
      calm: 0.7,
      joy: 0.5,
      curiosity: 0.6,
      empathy: 0.8,
      stress: 0.1,
      confidence: 0.7,
      attention: 0.8
    },
    memory: {
      enabled: session.memoryEnabled ?? true,
      loaded: false,
      memories: []
    },
    conversation: {
      id: `conversation-${session.sessionId}`,
      startedAt: now,
      lastMessageAt: null,
      turnCount: 0,
      messages: []
    },
    context: {
      language: session.language || "es",
      systemPrompt: buildSystemPrompt(session),
      readyForOpenAI: false
    },
    voice: {
      enabled: true,
      provider: "openai",
      voice: session.voice || "nova"
    },
    tools: []
  };
}

export function applyProfileToRuntime(runtime, companion = {}) {
  if (!runtime) return null;

  const now = new Date().toISOString();

  runtime.profile = {
    ...runtime.profile,
    loaded: true,
    loadedAt: now,
    companionId: companion.id || runtime.profile.companionId,
    name: companion.name || runtime.profile.name,
    language: companion.language || runtime.profile.language,
    voice: companion.voice || runtime.profile.voice,
    model: companion.model || runtime.profile.model,
    personality: companion.personality || runtime.profile.personality,
    memoryEnabled: companion.memoryEnabled ?? runtime.profile.memoryEnabled,
    emotionEnabled: companion.emotionEnabled ?? runtime.profile.emotionEnabled
  };

  runtime.memory.enabled = runtime.profile.memoryEnabled;
  runtime.context.language = runtime.profile.language;
  runtime.context.systemPrompt = buildSystemPromptFromRuntime(runtime);
  runtime.context.readyForOpenAI = true;
  runtime.voice.voice = runtime.profile.voice;
  runtime.updatedAt = now;

  return runtime;
}

export function applyStateToRuntime(runtime, event) {
  if (!runtime || !event) return null;

  runtime.state = {
    current: event.state,
    previous: event.previousState,
    changedAt: event.generatedAt
  };

  runtime.updatedAt = event.generatedAt;
  return runtime;
}

export function addRuntimeMessage(runtime, role, content, metadata = {}) {
  if (!runtime) return null;

  const now = new Date().toISOString();

  const message = {
    role,
    content: content || "",
    at: now,
    ...metadata
  };

  runtime.conversation.messages.push(message);
  runtime.conversation.lastMessageAt = now;
  runtime.conversation.turnCount += role === "user" ? 1 : 0;

  if (runtime.conversation.messages.length > 30) {
    runtime.conversation.messages.shift();
  }

  runtime.updatedAt = now;
  return message;
}

export function getRuntimeSnapshot(runtime) {
  if (!runtime) return null;

  return {
    runtimeVersion: runtime.runtimeVersion,
    sessionId: runtime.sessionId,
    createdAt: runtime.createdAt,
    updatedAt: runtime.updatedAt,
    state: runtime.state,
    profile: runtime.profile,
    emotion: runtime.emotion,
    memory: {
      enabled: runtime.memory.enabled,
      loaded: runtime.memory.loaded,
      memoryCount: runtime.memory.memories.length
    },
    conversation: {
      id: runtime.conversation.id,
      startedAt: runtime.conversation.startedAt,
      lastMessageAt: runtime.conversation.lastMessageAt,
      turnCount: runtime.conversation.turnCount,
      messageCount: runtime.conversation.messages.length
    },
    context: {
      language: runtime.context.language,
      readyForOpenAI: runtime.context.readyForOpenAI
    },
    voice: runtime.voice,
    tools: runtime.tools
  };
}

function buildSystemPrompt(session) {
  return [
    `Eres ${session.companionName || "Flow"}, un Companion IA de Flowly.`,
    `Idioma principal: ${session.language || "es"}.`,
    `Personalidad: ${session.personality || "Empático, natural, atento y cercano"}.`,
    "Debes responder de forma natural, breve, humana y útil."
  ].join("\n");
}

function buildSystemPromptFromRuntime(runtime) {
  return [
    `Eres ${runtime.profile.name}, un Companion IA de Flowly.`,
    `Idioma principal: ${runtime.profile.language}.`,
    `Personalidad: ${runtime.profile.personality}.`,
    `Voz configurada: ${runtime.profile.voice}.`,
    `Memoria: ${runtime.profile.memoryEnabled ? "activada" : "desactivada"}.`,
    `Emociones: ${runtime.profile.emotionEnabled ? "activadas" : "desactivadas"}.`,
    "Debes responder de forma natural, breve, humana y útil."
  ].join("\n");
}
