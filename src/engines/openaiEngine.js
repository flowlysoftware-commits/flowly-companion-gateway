export function isOpenAIRealtimeConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function buildRealtimeSessionConfig(runtime) {
  return {
    enabled: isOpenAIRealtimeConfigured(),
    model: runtime?.profile?.model || process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview",
    voice: runtime?.voice?.voice || "nova",
    language: runtime?.profile?.language || "es",
    instructions: runtime?.context?.systemPrompt || "Eres un Companion IA de Flowly."
  };
}

export function getOpenAIEngineSnapshot(runtime) {
  const config = buildRealtimeSessionConfig(runtime);

  return {
    configured: config.enabled,
    model: config.model,
    voice: config.voice,
    language: config.language,
    mode: "placeholder-ready"
  };
}
