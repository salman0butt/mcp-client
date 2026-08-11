# MCP Client API Integration Design

## Goal

Connect the existing React frontend to the MCP/Gemini runtime through a local HTTP/SSE API while preserving the current CLI workflow and entrypoint.

## Scope

- Keep `src/index.ts` as the CLI adapter and preserve its existing command-line chat behavior.
- Extract the reusable MCP/Gemini connection and query logic into a shared service.
- Add a separate API entrypoint bound to `127.0.0.1` for local single-user use.
- Add a connection form to the frontend inspector for local `.js`/`.py` paths and remote MCP URLs.
- Stream assistant text and MCP tool activity to the browser using Server-Sent Events.
- Keep the existing mock conversation fixtures as a useful offline/demo presentation when the API is not running, but route live sends and connection state through the API.

## Backend architecture

The shared service owns the MCP transport, Gemini model, connected tool catalog, and streamed query lifecycle. It exposes typed connection status and an async query stream. The CLI adapter uses the service for its current readline loop; the API adapter uses the same service for HTTP requests. Neither adapter owns MCP protocol details.

The API server is a separate `src/api.ts` entrypoint. It uses Node's built-in `http` module to avoid adding a web framework, binds to `127.0.0.1`, and listens on `API_PORT` or `8787`. The Vite development server proxies `/api` to this port.

## API contract

### `GET /api/health`

Returns `{ "ok": true }` without requiring an MCP connection.

### `GET /api/status`

Returns the current connection state:

```json
{
  "connected": true,
  "serverType": "remote",
  "serverPath": "https://example.test/mcp",
  "serverName": "Product Operations MCP",
  "transport": "streamable-http",
  "model": "gemini-2.5-flash",
  "tools": [{ "name": "search_feedback", "description": "..." }]
}
```

Disconnected status returns the same shape with `connected: false`, nullable server fields, and an empty tools list.

### `POST /api/connect`

Accepts `{ "serverType": "local" | "remote", "serverPath": string }`. Local paths must end in `.js` or `.py`; remote paths must parse as absolute URLs. Connecting replaces any existing connection, lists tools, and returns the status payload.

### `POST /api/disconnect`

Closes the active MCP transport and returns disconnected status. The operation is safe when already disconnected.

### `POST /api/chat`

Accepts `{ "message": string }`. The server returns `409` when disconnected and `400` for blank messages. A successful response uses `Content-Type: text/event-stream` and sends newline-delimited SSE events:

```text
event: assistant-text
data: {"text":"..."}

event: tool-start
data: {"id":"...","name":"search_feedback","args":{}}

event: tool-result
data: {"id":"...","name":"search_feedback","content":[],"isError":false,"durationMs":482}

event: complete
data: {"text":"..."}

```

Errors use `event: error` with `{ "message": string }`, then the stream closes. The API must not expose API keys or raw process environment values in responses.

## Frontend integration

- Add a typed API client that fetches health/status, connects/disconnects, and parses streamed chat events from a POST response body.
- On app load, request `/api/status`; an unavailable API shows a non-blocking disconnected state while keeping the seeded demo conversation visible.
- The inspector adds transport selection, server path input, connect/disconnect actions, and connection error feedback.
- Connection success replaces the inspector's server/tool metadata with live API data.
- Sending a message adds the user message immediately, creates an assistant placeholder, appends streamed text, shows running tool calls, resolves tool cards with output/duration, and marks the response complete.
- API errors become assistant error state or an inline connection error without losing the existing conversation.
- The connection indicator, inspector status, and composer status all derive from the same API-backed state.

## CLI compatibility

- `src/index.ts` remains runnable through the existing `start:server` script and continues to accept the existing CLI arguments.
- Add a separate `start:api` script for the HTTP API; it must not be invoked by the CLI script.
- `MCPClient` cleanup remains safe on CLI exit and API disconnect/server shutdown.

## Validation and security

- Local API binds only to loopback by default.
- Validate request bodies, path types, URLs, and blank messages before spawning processes or opening transports.
- Ensure one active connection per local API process; connecting a new server closes the previous transport first.
- Send appropriate CORS headers for the Vite dev origin while keeping the production default loopback-only.
- Add backend tests for validation, SSE event formatting, and connection status transitions; keep the existing tooling test passing.
- Add frontend tests for API status loading, connection form submit, streamed assistant/tool updates, and connection failure rendering.
- Verify client build/tests, root build/tests, CLI startup compatibility, and manual browser interaction through the proxied API.

## Non-goals

- No authentication, multi-user sessions, remote deployment, persistent conversation storage, or browser-side MCP process spawning.
- No change to the MCP protocol implementation beyond extracting the reusable service and adding stream events.
