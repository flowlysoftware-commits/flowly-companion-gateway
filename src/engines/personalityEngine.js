export function createPersonalityState(profile = {}) {
  const personalityText = profile.personality || "Empático, natural, atento y cercano";

  return {
    loaded: Boolean(profile.personality),
    raw: personalityText,
    traits: extractTraits(personalityText),
    tone: profile.tone || "natural",
    responseStyle: profile.responseStyle || "breve, humano y útil",
    safetyStyle: "prudente, claro y no invasivo"
  };
}

export function applyPersonalityProfile(personalityState, profile = {}) {
  const next = personalityState || createPersonalityState(profile);
  const personalityText = profile.personality || next.raw;

  next.loaded = true;
  next.raw = personalityText;
  next.traits = extractTraits(personalityText);
  next.tone = profile.tone || next.tone || "natural";
  next.responseStyle = profile.responseStyle || next.responseStyle || "breve, humano y útil";

  return next;
}

export function buildPersonalityInstructions(personalityState) {
  const personality = personalityState || createPersonalityState();
  const traits = personality.traits.length > 0
    ? personality.traits.join(", ")
    : personality.raw;

  return [
    `Personalidad principal: ${personality.raw}.`,
    `Rasgos activos: ${traits}.`,
    `Tono: ${personality.tone}.`,
    `Estilo de respuesta: ${personality.responseStyle}.`,
    `Regla de seguridad: ${personality.safetyStyle}.`
  ].join("\n");
}

function extractTraits(text) {
  return String(text || "")
    .split(/[,.\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}
