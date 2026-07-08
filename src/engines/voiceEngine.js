export function createVoiceConfig(profile = {}) {
  return {
    enabled: true,
    provider: profile.voiceProvider || "openai",
    voice: profile.voice || "nova",
    language: profile.language || "es",
    speed: profile.voiceSpeed || 1,
    style: profile.voiceStyle || "natural"
  };
}

export function applyVoiceProfile(voiceConfig, profile = {}) {
  const next = voiceConfig || createVoiceConfig(profile);

  next.provider = profile.voiceProvider || next.provider || "openai";
  next.voice = profile.voice || next.voice || "nova";
  next.language = profile.language || next.language || "es";
  next.speed = profile.voiceSpeed || next.speed || 1;
  next.style = profile.voiceStyle || next.style || "natural";

  return next;
}

export function getVoiceSnapshot(voiceConfig) {
  return {
    enabled: voiceConfig?.enabled ?? true,
    provider: voiceConfig?.provider || "openai",
    voice: voiceConfig?.voice || "nova",
    language: voiceConfig?.language || "es",
    speed: voiceConfig?.speed || 1,
    style: voiceConfig?.style || "natural"
  };
}
