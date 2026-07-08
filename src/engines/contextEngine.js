import { buildPersonalityInstructions } from "./personalityEngine.js";
import { getRelevantMemories } from "./memoryEngine.js";
import { getEmotionSnapshot } from "./emotionEngine.js";

export function buildSystemPrompt(runtime) {
  const profile = runtime?.profile || {};
  const emotion = getEmotionSnapshot(runtime?.emotion);
  const personalityInstructions = buildPersonalityInstructions(runtime?.personality);

  return [
    `Eres ${profile.name || "Flow"}, un Companion IA de Flowly.`,
    `Idioma principal: ${profile.language || "es"}.`,
    `Voz configurada: ${profile.voice || "nova"}.`,
    personalityInstructions,
    `Estado emocional actual: ${emotion.mood}. Calma ${emotion.calm}, atención ${emotion.attention}, empatía ${emotion.empathy}.`,
    "Actúa como un companion vivo: escucha, piensa y responde de forma natural.",
    "Responde con frases claras, útiles y no demasiado largas."
  ].join("\n");
}

export function buildOpenAIContext(runtime, userText = "") {
  const relevantMemories = getRelevantMemories(runtime?.memory, userText);
  const recentMessages = runtime?.conversation?.messages?.slice(-12) || [];
  const emotion = getEmotionSnapshot(runtime?.emotion);

  return {
    system: buildSystemPrompt(runtime),
    profile: runtime?.profile || null,
    state: runtime?.state || null,
    emotion,
    memories: relevantMemories,
    recentMessages,
    userText,
    tools: runtime?.tools || []
  };
}

export function buildRuntimeResponse(runtime, userText = "") {
  const profileName = runtime?.profile?.name || "Flow";
  const emotion = getEmotionSnapshot(runtime?.emotion);
  const text = String(userText || "").trim();

  if (!text) {
    return {
      text: "Estoy aquí contigo. Te escucho.",
      emotion: emotion.mood
    };
  }

  if (/[?¿]/.test(text)) {
    return {
      text: `Buena pregunta. Ahora mismo estoy procesándolo como ${profileName} y preparando una respuesta más inteligente.`,
      emotion: emotion.mood
    };
  }

  return {
    text: `He recibido tu mensaje: ${text}`,
    emotion: emotion.mood
  };
}
