const DEFAULT_EMOTION = {
  mood: "neutral",
  calm: 0.7,
  joy: 0.5,
  curiosity: 0.6,
  empathy: 0.8,
  stress: 0.1,
  confidence: 0.7,
  attention: 0.8,
  energy: 0.6,
  updatedAt: null
};

export function createEmotionState(seed = {}) {
  return {
    ...DEFAULT_EMOTION,
    ...seed,
    updatedAt: new Date().toISOString()
  };
}

export function updateEmotionFromState(emotionState, state) {
  const emotion = emotionState || createEmotionState();
  const next = { ...emotion };

  if (state === "listening") {
    next.attention += 0.08;
    next.calm += 0.03;
    next.curiosity += 0.04;
  }

  if (state === "thinking") {
    next.attention += 0.1;
    next.curiosity += 0.08;
    next.energy += 0.02;
  }

  if (state === "speaking") {
    next.confidence += 0.05;
    next.energy += 0.04;
    next.empathy += 0.02;
  }

  if (state === "idle") {
    next.calm += 0.06;
    next.stress -= 0.04;
    next.energy -= 0.02;
  }

  return normalizeEmotion(next);
}

export function updateEmotionFromUserText(emotionState, text = "") {
  const emotion = emotionState || createEmotionState();
  const next = { ...emotion };
  const normalized = String(text).toLowerCase();

  if (/[?¿]/.test(normalized)) {
    next.curiosity += 0.06;
    next.attention += 0.04;
  }

  if (/(gracias|perfecto|genial|bien|me gusta|fantástico|fantastico)/.test(normalized)) {
    next.joy += 0.08;
    next.confidence += 0.04;
    next.stress -= 0.03;
  }

  if (/(problema|mal|error|fallo|no funciona|triste|miedo|preocupa)/.test(normalized)) {
    next.empathy += 0.08;
    next.attention += 0.05;
    next.stress += 0.04;
    next.joy -= 0.03;
  }

  next.mood = inferMood(next);
  return normalizeEmotion(next);
}

export function getEmotionSnapshot(emotionState) {
  const emotion = normalizeEmotion(emotionState || createEmotionState());
  return {
    mood: emotion.mood,
    calm: emotion.calm,
    joy: emotion.joy,
    curiosity: emotion.curiosity,
    empathy: emotion.empathy,
    stress: emotion.stress,
    confidence: emotion.confidence,
    attention: emotion.attention,
    energy: emotion.energy,
    updatedAt: emotion.updatedAt
  };
}

function normalizeEmotion(emotion) {
  const normalized = {
    ...DEFAULT_EMOTION,
    ...emotion,
    calm: clamp(emotion.calm),
    joy: clamp(emotion.joy),
    curiosity: clamp(emotion.curiosity),
    empathy: clamp(emotion.empathy),
    stress: clamp(emotion.stress),
    confidence: clamp(emotion.confidence),
    attention: clamp(emotion.attention),
    energy: clamp(emotion.energy),
    updatedAt: new Date().toISOString()
  };

  normalized.mood = inferMood(normalized);
  return normalized;
}

function inferMood(emotion) {
  if (emotion.stress > 0.6) return "concerned";
  if (emotion.joy > 0.68) return "happy";
  if (emotion.curiosity > 0.72) return "curious";
  if (emotion.empathy > 0.82) return "empathetic";
  return "neutral";
}

function clamp(value) {
  const number = Number.isFinite(value) ? value : 0.5;
  return Math.max(0, Math.min(1, Number(number.toFixed(3))));
}
