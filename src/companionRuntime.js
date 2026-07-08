import {
  createPersonalityState,
  applyPersonalityProfile
} from "./engines/personalityEngine.js";
import {
  createEmotionState,
  updateEmotionFromState,
  updateEmotionFromUserText,
  getEmotionSnapshot
} from "./engines/emotionEngine.js";
import {
  createMemoryState,
  applyMemorySeed,
  processUserMemory,
  getMemorySnapshot
} from "./engines/memoryEngine.js";
import {
  buildSystemPrompt,
  buildOpenAIContext,
  buildRuntimeResponse
} from "./engines/contextEngine.js";
import {
  createVoiceConfig,
  applyVoiceProfile,
  getVoiceSnapshot
} from "./engines/voiceEngine.js";
import { getOpenAIEngineSnapshot } from "./engines/openaiEngine.js";
import { buildUnityActionsFromRuntime } from "./engines/actionEngine.js";

export function createCompanionRuntime(session) {
  const now = new Date().toISOString();
  const profile = {
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
  };

  const runtime = {
    runtimeVersion: "2.0.0",
    sessionId: session.sessionId,
    createdAt: now,
    updatedAt: now,
    state: {
      current: session.state || "connected",
      previous: session.previousState || null,
      changedAt: session.stateChangedAt || now
    },
    profile,
    personality: createPersonalityState(profile),
    emotion: createEmotionState({ mood: session.emotion || "neutral" }),
    memory: createMemoryState({ enabled: profile.memoryEnabled }),
    conversation: {
      id: `conversation-${session.sessionId}`,
      startedAt: now,
      lastMessageAt: null,
      turnCount: 0,
      messages: []
    },
    context: {
      language: profile.language,
      systemPrompt: "",
      lastBuiltAt: null,
      readyForOpenAI: false,
      lastOpenAIContext: null
    },
    voice: createVoiceConfig(profile),
    openai: {
      configured: false,
      model: profile.model,
      mode: "placeholder-ready"
    },
    tools: [],
    actions: []
  };

  refreshRuntimeContext(runtime);
  return runtime;
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

  runtime.personality = applyPersonalityProfile(runtime.personality, runtime.profile);
  runtime.memory.enabled = runtime.profile.memoryEnabled;
  runtime.memory = applyMemorySeed(runtime.memory, companion.memories || []);
  runtime.voice = applyVoiceProfile(runtime.voice, runtime.profile);
  runtime.openai = getOpenAIEngineSnapshot(runtime);
  runtime.updatedAt = now;

  refreshRuntimeContext(runtime);
  return runtime;
}

export function applyStateToRuntime(runtime, event) {
  if (!runtime || !event) return null;

  runtime.state = {
    current: event.state,
    previous: event.previousState,
    changedAt: event.generatedAt
  };

  runtime.emotion = updateEmotionFromState(runtime.emotion, event.state);
  runtime.updatedAt = event.generatedAt;
  runtime.actions = buildUnityActionsFromRuntime(runtime, "session.state.changed");
  refreshRuntimeContext(runtime);
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
  refreshRuntimeContext(runtime);
  return message;
}

export function processRuntimeUserMessage(runtime, userText, metadata = {}) {
  if (!runtime) return null;

  addRuntimeMessage(runtime, "user", userText, {
    source: metadata.source || "unity"
  });

  runtime.emotion = updateEmotionFromUserText(runtime.emotion, userText);

  const memoryResult = processUserMemory(runtime.memory, userText);
  runtime.memory = memoryResult.memory;

  const openAIContext = buildOpenAIContext(runtime, userText);
  runtime.context.lastOpenAIContext = openAIContext;

  const response = buildRuntimeResponse(runtime, userText);
  addRuntimeMessage(runtime, "assistant", response.text, {
    source: "runtime.v2",
    emotion: response.emotion
  });

  runtime.actions = buildUnityActionsFromRuntime(runtime, "companion.message");
  runtime.updatedAt = new Date().toISOString();
  refreshRuntimeContext(runtime);

  return {
    text: response.text,
    emotion: response.emotion,
    memoriesStored: memoryResult.stored,
    context: openAIContext,
    runtime: getRuntimeSnapshot(runtime)
  };
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
    personality: {
      loaded: runtime.personality?.loaded ?? false,
      traits: runtime.personality?.traits || [],
      tone: runtime.personality?.tone || "natural",
      responseStyle: runtime.personality?.responseStyle || "breve, humano y útil"
    },
    emotion: getEmotionSnapshot(runtime.emotion),
    memory: getMemorySnapshot(runtime.memory),
    conversation: {
      id: runtime.conversation.id,
      startedAt: runtime.conversation.startedAt,
      lastMessageAt: runtime.conversation.lastMessageAt,
      turnCount: runtime.conversation.turnCount,
      messageCount: runtime.conversation.messages.length
    },
    context: {
      language: runtime.context.language,
      readyForOpenAI: runtime.context.readyForOpenAI,
      lastBuiltAt: runtime.context.lastBuiltAt,
      hasOpenAIContext: Boolean(runtime.context.lastOpenAIContext)
    },
    voice: getVoiceSnapshot(runtime.voice),
    openai: getOpenAIEngineSnapshot(runtime),
    tools: runtime.tools,
    actions: runtime.actions || []
  };
}

function refreshRuntimeContext(runtime) {
  if (!runtime) return null;

  const now = new Date().toISOString();
  runtime.context.language = runtime.profile.language;
  runtime.context.systemPrompt = buildSystemPrompt(runtime);
  runtime.context.readyForOpenAI = Boolean(runtime.profile.loaded);
  runtime.context.lastBuiltAt = now;
  runtime.openai = getOpenAIEngineSnapshot(runtime);
  runtime.updatedAt = now;

  return runtime.context;
}
