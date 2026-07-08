# Flowly Companion Gateway

Servidor realtime para Flow Companion Engine.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm install
npm start
```

## Endpoints

- `GET /health` comprueba estado del gateway.
- `WS /flow-companion` conexión WebSocket para Unity Companion.

## Unity

En `FlowRealtimeConfig` usa:

```text
ws://localhost:3001/flow-companion
```

En producción será algo como:

```text
wss://gateway.flowlyia.com/flow-companion
```
