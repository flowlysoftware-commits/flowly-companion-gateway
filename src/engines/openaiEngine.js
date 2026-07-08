const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isOpenAIRealtimeConfigured() {
  return isOpenAIConfigured();
}

export function getOpenAITextModel(runtime) {
  const profileModel = runtime?.profile?.model;
  const envModel = process.env.OPENAI_TEXT_MODEL;

  if (envModel) return envModel;

  // If the profile is configured with a realtime placeholder, use a safe text model for the
  // first Conversation Engine milestone. Realtime audio will use OPENAI_REALTIME_MODEL later.
  if (!profileModel || /realtime/i.test(profileModel)) {
    return "gpt-4.1-mini";
  }

  return profileModel;
}

export function getOpenAIRealtimeModel(runtime) {
  return process.env.OPENAI_REALTIME_MODEL || runtime?.profile?.realtimeModel || "gpt-4o-realtime-preview";
}

export function buildRealtimeSessionConfig(runtime) {
  return {
    enabled: isOpenAIRealtimeConfigured(),
    model: getOpenAIRealtimeModel(runtime),
    voice: runtime?.voice?.voice || "nova",
    language: runtime?.profile?.language || "es",
    instructions: runtime?.context?.systemPrompt || "Eres un Companion IA de Flowly."
  };
}

export function getOpenAIEngineSnapshot(runtime) {
  return {
    configured: isOpenAIConfigured(),
    textModel: getOpenAITextModel(runtime),
    realtimeModel: getOpenAIRealtimeModel(runtime),
    voice: runtime?.voice?.voice || "nova",
    language: runtime?.profile?.language || "es",
    mode: isOpenAIConfigured() ? "conversation-ready" : "fallback-local",
    realtime: {
      configured: isOpenAIRealtimeConfigured(),
      status: "prepared-not-streaming"
    }
  };
}

export async function generateCompanionReply({
  runtime,
  context,
  userText,
  signal
}) {
  if (!isOpenAIConfigured()) {
    return {
      ok: false,
      provider: "openai",
      usedFallback: true,
      error: "OPENAI_API_KEY is not configured.",
      text: buildLocalFallbackReply(runtime, userText)
    };
  }

  const model = getOpenAITextModel(runtime);
  const body = {
    model,
    instructions: context?.system || runtime?.context?.systemPrompt || "Eres un Companion IA de Flowly.",
    input: buildConversationInput(context, userText),
    max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 450)
  };

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error?.message || `OpenAI HTTP ${response.status}`;
      return {
        ok: false,
        provider: "openai",
        model,
        usedFallback: true,
        error: message,
        status: response.status,
        text: buildLocalFallbackReply(runtime, userText)
      };
    }

    const text = extractResponseText(data);

    return {
      ok: true,
      provider: "openai",
      model,
      responseId: data?.id || null,
      usedFallback: false,
      text: text || buildLocalFallbackReply(runtime, userText),
      rawType: data?.object || "response"
    };
  } catch (error) {
    return {
      ok: false,
      provider: "openai",
      model,
      usedFallback: true,
      error: error?.message || "Unknown OpenAI error",
      text: buildLocalFallbackReply(runtime, userText)
    };
  }
}

function buildConversationInput(context, userText) {
  const recentMessages = context?.recentMessages || [];
  const memories = context?.memories || [];
  const emotion = context?.emotion || {};
  const state = context?.state || {};

  const contextBlock = [
    "Contexto interno del Companion:",
    `Estado actual: ${state?.current || "unknown"}.`,
    `Emoción: ${emotion?.mood || "neutral"}.`,
    memories.length > 0
      ? `Memorias relevantes:\n${memories.map((memory) => `- ${memory.text}`).join("\n")}`
      : "Memorias relevantes: ninguna.",
    recentMessages.length > 0
      ? `Mensajes recientes:\n${recentMessages.map((message) => `${message.role}: ${message.content}`).join("\n")}`
      : "Mensajes recientes: ninguno.",
    "",
    "Responde como el Companion, de forma natural, breve y útil."
  ].join("\n");

  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `${contextBlock}\n\nUsuario: ${userText || ""}`
        }
      ]
    }
  ];
}

function extractResponseText(data) {
  if (!data) return "";

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const parts = [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === "string") parts.push(part.text);
      if (typeof part.output_text === "string") parts.push(part.output_text);
      if (part.type === "output_text" && typeof part.text === "string") parts.push(part.text);
    }
  }

  return parts.join("\n").trim();
}

function buildLocalFallbackReply(runtime, userText) {
  const name = runtime?.profile?.name || "Flow";
  const text = String(userText || "").trim();

  if (!text) {
    return "Estoy aquí contigo. Te escucho.";
  }

  if (/[?¿]/.test(text)) {
    return `Buena pregunta. Soy ${name} y ya tengo el motor de conversación preparado; ahora estoy usando una respuesta segura mientras se estabiliza OpenAI.`;
  }

  return `Te escucho. Has dicho: ${text}`;
}
