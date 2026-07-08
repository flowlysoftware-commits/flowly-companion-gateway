import { generateCompanionReply } from "./openaiEngine.js";
import { buildUnityActionsFromRuntime } from "./actionEngine.js";

export async function processConversationTurn({
  session,
  sessions,
  userText,
  source = "unity"
}) {
  const runtime = session?.runtime;

  const prepared = sessions.prepareUserMessage(session, userText, { source });
  const context = prepared?.context || runtime?.context?.lastOpenAIContext || null;

  const openaiResult = await generateCompanionReply({
    runtime,
    context,
    userText
  });

  const assistantText = sanitizeAssistantText(openaiResult?.text);

  const committed = sessions.commitAssistantMessage(session, assistantText, {
    source: openaiResult?.ok ? "openai.responses" : "runtime.fallback",
    provider: openaiResult?.provider || "local",
    model: openaiResult?.model || null,
    responseId: openaiResult?.responseId || null,
    usedFallback: Boolean(openaiResult?.usedFallback),
    error: openaiResult?.error || null
  });

  if (runtime) {
    runtime.actions = buildUnityActionsFromRuntime(runtime, "companion.message");
  }

  return {
    ok: Boolean(openaiResult?.ok),
    text: assistantText,
    emotion: committed?.emotion || runtime?.emotion?.mood || "neutral",
    memoriesStored: prepared?.memoriesStored || [],
    context,
    openai: {
      ok: Boolean(openaiResult?.ok),
      provider: openaiResult?.provider || "openai",
      model: openaiResult?.model || null,
      responseId: openaiResult?.responseId || null,
      usedFallback: Boolean(openaiResult?.usedFallback),
      error: openaiResult?.error || null
    },
    runtime: sessions.getRuntimeSnapshot(session)
  };
}

function sanitizeAssistantText(text) {
  const value = String(text || "").trim();

  if (!value) {
    return "Estoy aquí contigo. Te escucho.";
  }

  return value.slice(0, 4000);
}
