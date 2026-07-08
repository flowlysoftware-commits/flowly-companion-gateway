export function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createEvent(type, payload = {}) {
  return JSON.stringify({
    type,
    generatedAt: new Date().toISOString(),
    ...payload
  });
}

export function send(socket, type, payload = {}) {
  if (!socket || socket.readyState !== socket.OPEN) return;
  socket.send(createEvent(type, payload));
}

export function sendError(socket, message, details = {}) {
  send(socket, "error", {
    message,
    details
  });
}
