export function createMemoryState(options = {}) {
  return {
    enabled: options.enabled ?? true,
    loaded: false,
    memories: [],
    pending: [],
    lastUpdatedAt: new Date().toISOString()
  };
}

export function applyMemorySeed(memoryState, memories = []) {
  const memory = memoryState || createMemoryState();
  memory.memories = Array.isArray(memories) ? memories.slice(0, 50) : [];
  memory.loaded = true;
  memory.lastUpdatedAt = new Date().toISOString();
  return memory;
}

export function processUserMemory(memoryState, text = "") {
  const memory = memoryState || createMemoryState();

  if (!memory.enabled) {
    return {
      memory,
      stored: []
    };
  }

  const candidates = extractMemoryCandidates(text);
  const stored = [];

  for (const candidate of candidates) {
    const score = scoreMemoryCandidate(candidate.text);

    if (score < 0.55) continue;

    const item = {
      id: `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: candidate.type,
      text: candidate.text,
      score,
      source: "conversation",
      createdAt: new Date().toISOString()
    };

    memory.memories.push(item);
    memory.pending.push(item);
    stored.push(item);
  }

  if (memory.memories.length > 100) {
    memory.memories = memory.memories.slice(-100);
  }

  memory.lastUpdatedAt = new Date().toISOString();

  return {
    memory,
    stored
  };
}

export function getRelevantMemories(memoryState, text = "", limit = 5) {
  const memory = memoryState || createMemoryState();
  if (!memory.enabled || memory.memories.length === 0) return [];

  const words = new Set(String(text).toLowerCase().split(/\W+/).filter(Boolean));

  return memory.memories
    .map((item) => ({
      ...item,
      relevance: computeRelevance(item.text, words)
    }))
    .sort((a, b) => b.relevance - a.relevance || b.score - a.score)
    .slice(0, limit);
}

export function getMemorySnapshot(memoryState) {
  const memory = memoryState || createMemoryState();
  return {
    enabled: memory.enabled,
    loaded: memory.loaded,
    memoryCount: memory.memories.length,
    pendingCount: memory.pending.length,
    lastUpdatedAt: memory.lastUpdatedAt
  };
}

function extractMemoryCandidates(text) {
  const value = String(text || "").trim();
  if (!value) return [];

  const candidates = [];

  const patterns = [
    { type: "identity", regex: /\b(me llamo|mi nombre es|soy)\s+([^,.!?]+)/i },
    { type: "preference", regex: /\b(me gusta|prefiero|odio|no me gusta|me encanta)\s+([^,.!?]+)/i },
    { type: "relationship", regex: /\b(mi\s+(perro|gato|pareja|madre|padre|hijo|hija|amigo|amiga)\s+(se llama|es))\s+([^,.!?]+)/i },
    { type: "goal", regex: /\b(quiero|necesito|mi objetivo es|estoy intentando)\s+([^,.!?]+)/i }
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern.regex);
    if (match) {
      candidates.push({
        type: pattern.type,
        text: match[0].trim()
      });
    }
  }

  if (candidates.length === 0 && value.length > 25 && /\brecuerda\b/i.test(value)) {
    candidates.push({
      type: "explicit",
      text: value
    });
  }

  return candidates.slice(0, 5);
}

function scoreMemoryCandidate(text) {
  const value = String(text || "").trim();
  if (!value) return 0;

  let score = 0.45;
  if (value.length > 20) score += 0.1;
  if (/\b(me llamo|mi nombre|recuerda|prefiero|me gusta|mi objetivo|se llama)\b/i.test(value)) score += 0.25;
  if (/\b(hoy|ahora|temporal|mañana)\b/i.test(value)) score -= 0.15;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function computeRelevance(text, words) {
  const valueWords = String(text || "").toLowerCase().split(/\W+/).filter(Boolean);
  if (valueWords.length === 0 || words.size === 0) return 0.1;

  let matches = 0;
  for (const word of valueWords) {
    if (words.has(word)) matches += 1;
  }

  return matches / valueWords.length;
}
