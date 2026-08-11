
# MCP Client API Integration Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a loopback HTTP/SSE API that reuses the MCP/Gemini runtime, keeps the CLI intact, and drives the React client with live connection, tool, and assistant events.

**Architecture:** Extract the MCP transport and Gemini query lifecycle into a shared MCPClient service. Keep src/index.ts as the CLI adapter, add src/api.ts as a Node built-in HTTP adapter, and stream typed events from POST /api/chat over SSE. The React app gets a typed API client, a live connection form in the inspector, and event-driven conversation updates with the existing seeded fixtures retained as an offline/demo fallback.

**Tech Stack:** Node.js built-in http, @google/genai generateContentStream, @modelcontextprotocol/client, React, TypeScript, Vite, Tailwind CSS, Vitest, and Bun tests.

## Global Constraints

- Keep src/index.ts as the CLI adapter and preserve its existing command-line chat behavior.
- Add a separate start:api script for the HTTP API; it must not be invoked by the CLI script.
- The API server binds to 127.0.0.1 and listens on API_PORT or 8787.
- Local paths must end in .js or .py; remote paths must parse as absolute URLs.
- The API must expose /api/health, /api/status, /api/connect, /api/disconnect, and streamed /api/chat routes.
- Chat events use assistant-text, tool-start, tool-result, complete, and error event names.
- No authentication, multi-user sessions, persistence, browser-side MCP process spawning, or web framework is added.
- The client must keep the seeded demo conversation visible when the API is unavailable, while live sends and connection state use the API.
- Existing root and client tests/builds must continue to pass.

## File map

- Create src/mcpClient.ts: reusable MCP/Gemini service, connection status, and streaming query event types.
- Modify src/index.ts: keep the CLI entrypoint and readline behavior while consuming the shared service.
- Create src/mcpClient.test.ts: shared-service validation and event-shape tests that do not require a live API key.
- Create src/api.ts: loopback HTTP server, route validation, JSON responses, SSE writer, and graceful shutdown.
- Create src/api.test.ts: API route validation, status transitions, health response, and SSE formatting tests using an injected fake service.
- Modify package.json: add start:api and start:cli aliases while preserving start:server.
- Modify tsconfig.json: compile the new runtime files while excluding test files from the production build.
- Modify client/vite.config.ts: proxy /api to http://127.0.0.1:8787 in development.
- Create client/src/api/types.ts: browser-side status, tool, and SSE event contracts.
- Create client/src/api/client.ts: fetch helpers, connection operations, and streamed chat request.
- Create client/src/api/sse.ts: incremental SSE response-body parser.
- Create client/src/api/client.vitest.ts: parser and API-client behavior tests with mocked fetch streams.
- Modify client/src/types.ts: live API connection and stream state types used by the UI.
- Modify client/src/data.ts: retain fixtures and add a conversion helper for API tool metadata.
- Modify client/src/App.tsx: API status loading, connection lifecycle, streamed chat state, generation guards, and error presentation.
- Modify client/src/components/Inspector.tsx: transport/path connection form, connect/disconnect actions, and live API error state.
- Modify client/src/components/ChatHeader.tsx: render API-derived connection state without local fake toggling.
- Modify client/src/components/Composer.tsx: keep send behavior while reflecting API errors/responding state.
- Modify client/src/components/ConversationView.tsx: render running/completed/error tool events as they arrive.
- Modify client/src/App.vitest.tsx: cover API-backed connection and streaming interactions.
- Modify README.md: document CLI mode, API mode, client dev mode, and the local connection workflow.

---

### Task 1: Extract the shared MCP/Gemini service

**Files:**
- Create: src/mcpClient.ts
- Create: src/mcpClient.test.ts
- Modify: src/index.ts
- Modify: tsconfig.json

**Interfaces:**
- MCPClient.connectToServer(serverPath: string, serverType: "local" | "remote"): Promise<MCPConnectionStatus>
- MCPClient.getStatus(): MCPConnectionStatus
- MCPClient.processQuery(query: string): Promise<string> for the CLI.
- MCPClient.streamQuery(query: string): AsyncGenerator<MCPStreamEvent> for the API.
- MCPClient.cleanup(): Promise<void>.
- MCPStreamEvent is the discriminated union of assistant-text, tool-start, tool-result, and complete event objects.

- [ ] Step 1: Add the shared connection and stream types

Define MCPConnectionStatus with connected, nullable serverType, nullable serverPath, nullable serverName, nullable transport, model, and tools. Define the event union above so both CLI-adjacent service code and API code can narrow events by type.

- [ ] Step 2: Move connection setup and cleanup into MCPClient

Preserve the current local .js/.py validation, remote URL construction, stdio/streamable HTTP transports, listTools() call, and cleanup behavior. getStatus() must return an empty tools list and nullable server fields when disconnected.

- [ ] Step 3: Preserve the CLI query path

Move the existing non-streaming processQuery implementation into the shared service without changing function-calling behavior or final text formatting. Update src/index.ts to import the service and retain its readline loop, quit handling, argument usage, and cleanup flow.

- [ ] Step 4: Add the streaming query path

Use this.gemini.models.generateContentStream for each Gemini turn. Yield each non-empty response.text as assistant-text; when function calls are returned, yield tool-start, call the MCP tool, measure elapsed milliseconds, then yield tool-result and continue the same conversation with the function response. Yield complete with the accumulated text after no function calls remain. Do not yield secrets or raw environment values.

- [ ] Step 5: Add focused service tests and compile configuration

Test local/remote path validation and disconnected status shape without a live model. Update root TypeScript includes to compile src/**/*.ts while excluding src/**/*.test.ts. Run:

    bun test src/tooling.test.ts src/mcpClient.test.ts
    bun run build

Expected: all focused tests pass and the root build emits both dist/src/index.js and the new API/service runtime imports without changing CLI output semantics.

- [ ] Step 6: Commit

    git add src/index.ts src/mcpClient.ts src/mcpClient.test.ts tsconfig.json
    git commit -m "refactor: extract shared MCP client service"

---

### Task 2: Add the loopback HTTP/SSE API server

**Files:**
- Create: src/api.ts
- Create: src/api.test.ts
- Modify: package.json

**Interfaces:**
- createApiServer(client: MCPClient): http.Server
- formatSseEvent(eventName: string, payload: unknown): string
- validateConnectPayload(value: unknown): ConnectRequest
- GET /api/health, GET /api/status, POST /api/connect, POST /api/disconnect, and POST /api/chat exactly as defined in the spec.

- [ ] Step 1: Write validation and SSE tests first

Cover: health returns { ok: true }; blank chat bodies return 400; malformed JSON returns 400; local non-.js/.py paths return 400; remote non-absolute URLs return 400; disconnected chat returns 409; formatSseEvent("assistant-text", { text: "hi" }) returns event: assistant-text, data: {"text":"hi"}, and a blank line.

- [ ] Step 2: Implement request parsing and safe JSON responses

Use a bounded request body reader, return application/json, set Access-Control-Allow-Origin only for the Vite dev origin, and respond to OPTIONS with the allowed methods/headers. Never include API keys, environment values, or raw stack traces in error bodies.

- [ ] Step 3: Implement connection/status routes

Use one MCPClient instance for the API process. POST /api/connect validates input, calls connectToServer, and returns getStatus(). A new connection replaces the old one by awaiting cleanup() first. POST /api/disconnect is idempotent. GET /api/status always returns a stable status shape.

- [ ] Step 4: Implement streamed chat

Reject blank/disconnected requests before opening the stream. Set Content-Type: text/event-stream, Cache-Control: no-cache, and Connection: keep-alive; iterate client.streamQuery(message) and write each event with formatSseEvent. Send an error event for runtime failures if headers are already sent, then close the response.

- [ ] Step 5: Add startup/shutdown and package scripts

Export startApiServer() that reads API_PORT with a 8787 fallback, binds 127.0.0.1, logs the local URL, and closes the MCP client on SIGINT/SIGTERM. Add start:api: node dist/src/api.js and start:cli: node dist/src/index.js; leave the existing start:server script unchanged.

- [ ] Step 6: Run API tests and commit

    bun test src/api.test.ts src/mcpClient.test.ts
    bun run build
    git add src/api.ts src/api.test.ts package.json
    git commit -m "feat: add streaming MCP API server"

---

### Task 3: Add the browser API client, SSE parser, and Vite proxy

**Files:**
- Create: client/src/api/types.ts
- Create: client/src/api/sse.ts
- Create: client/src/api/client.ts
- Create: client/src/api/client.vitest.ts
- Modify: client/vite.config.ts

**Interfaces:**
- parseSseStream(stream: ReadableStream<Uint8Array>, onEvent: (event: ApiStreamEvent) => void): Promise<void>.
- getStatus(): Promise<ApiStatus>.
- connect(request: ConnectRequest): Promise<ApiStatus>.
- disconnect(): Promise<ApiStatus>.
- streamChat(message: string, handlers: StreamHandlers, signal?: AbortSignal): Promise<void>.

- [ ] Step 1: Define browser API contracts

Mirror the JSON response and event discriminants from the backend, but use browser-safe ServerTool shapes. Define StreamHandlers with onAssistantText, onToolStart, onToolResult, onComplete, and onError callbacks.

- [ ] Step 2: Write parser tests first

Feed a ReadableStream split across arbitrary chunk boundaries and assert that two SSE events, multi-line data payloads, blank keep-alive lines, and an event: error payload are parsed correctly. Add a fetch mock test that turns non-2xx responses into readable error messages.

- [ ] Step 3: Implement the incremental SSE parser

Decode chunks with TextDecoder, buffer until a blank line, track the most recent event: value, join data: lines with newlines, JSON parse the data, and call the handler. Flush the final buffered event when the stream ends.

- [ ] Step 4: Implement fetch helpers and streamChat

Use relative /api/... URLs so Vite proxying and same-origin production both work. Set JSON headers for mutations, check response.ok, require a body for chat, and pass the response body to parseSseStream. Abort should propagate without turning into a visible API failure message.

- [ ] Step 5: Add the Vite development proxy

Configure server.proxy["/api"] to target http://127.0.0.1:8787 with changeOrigin: true.

- [ ] Step 6: Run client tests/build and commit

    cd client
    bun test src/api/client.vitest.ts
    bun run typecheck
    bun run build
    git add src/api vite.config.ts
    git commit -m "feat: add browser MCP API client"

---

### Task 4: Integrate live connection state and the inspector form

**Files:**
- Modify: client/src/types.ts
- Modify: client/src/data.ts
- Modify: client/src/App.tsx
- Modify: client/src/components/Inspector.tsx
- Modify: client/src/components/ChatHeader.tsx
- Modify: client/src/components/Composer.tsx
- Modify: client/src/App.vitest.tsx

**Interfaces:**
- Inspector receives apiStatus, connectionDraft, isConnecting, connectionError, onDraftChange, onConnect, and onDisconnect in addition to its existing lifecycle props.
- App owns apiStatus, connectionDraft, isConnecting, and connectionError; the header/composer read connection state from that single source.

- [ ] Step 1: Add API-backed state types and conversion helpers

Extend the client types with ServerType, ApiStatus, ConnectionDraft, and ConnectionError. Add serverToolsFromApiStatus() in data.ts to convert live API tools to the inspector’s compact display shape while retaining demo fixtures for disconnected/offline presentation.

- [ ] Step 2: Load status on app mount

Call getStatus() once from an effect. On success, populate connection state, server metadata, and live tools. On failure, keep the seeded conversation and set a non-blocking connectionError such as API unavailable — start the API server to connect.

- [ ] Step 3: Build the inspector connection form

Add a transport select (local/remote), a server path input, connect/disconnect buttons, disabled/loading states, and inline validation/error feedback. Use labels and aria-describedby; show local path guidance for .js/.py and URL guidance for remote transport.

- [ ] Step 4: Wire connect/disconnect actions

Submit through the browser API client, update status/tools/server info on success, preserve the last successful draft, and surface server errors inline. Disconnect resets live status without deleting demo conversation fixtures.

- [ ] Step 5: Add frontend tests

Mock getStatus and connect; assert mount-time status hydration, failed API fallback presentation, connect form submission, connected inspector metadata, and disconnect state. Preserve the existing responsive/focus tests.

- [ ] Step 6: Run client tests/build and commit

    cd client
    bun test
    bun run typecheck
    bun run build
    git add src/types.ts src/data.ts src/App.tsx src/components src/App.vitest.tsx
    git commit -m "feat: connect inspector to MCP API"

---

### Task 5: Integrate streamed chat and live tool cards

**Files:**
- Modify: client/src/App.tsx
- Modify: client/src/components/ConversationView.tsx
- Modify: client/src/components/Composer.tsx
- Modify: client/src/App.vitest.tsx

**Interfaces:**
- App.handleSend() uses streamChat() and updates the active thread through the existing generation guard.
- Each tool-start creates a ToolCall with status running; each tool-result updates it to success or error with serialized output and duration.

- [ ] Step 1: Write streaming interaction tests first

Mock streamChat to emit text chunks, a tool start, a tool result, and complete. Assert the assistant text grows incrementally, the tool card shows running then completed, and isResponding returns false after complete. Add error and connection-loss assertions.

- [ ] Step 2: Add assistant placeholder and event updates

When sending, append the user message and an assistant placeholder to the active thread (or new-chat thread), capture the conversation generation/id, and call streamChat. assistant-text appends text to the matching assistant message; complete fills any final text and clears responding state.

- [ ] Step 3: Add running/completed/error tool state

On tool-start, attach a running ToolCall with JSON input. On tool-result, serialize MCP content safely for the output block, set the status, and calculate the displayed duration from durationMs. Preserve tool cards when the assistant continues after a tool call.

- [ ] Step 4: Handle aborts, stale events, and failures

Use an AbortController per send. Invalidate the generation on New chat or thread switch; ignore late stream callbacks for a stale generation. Abort on cleanup and render a readable assistant/API error without corrupting the active thread.

- [ ] Step 5: Preserve offline/demo behavior

If no API is connected, keep the seeded fixtures visible and prevent live send with an inline connection hint instead of running the old fake timeout response. When connected, every new send uses SSE.

- [ ] Step 6: Run client tests/build and commit

    cd client
    bun test
    bun run typecheck
    bun run build
    git add src/App.tsx src/components/ConversationView.tsx src/components/Composer.tsx src/App.vitest.tsx
    git commit -m "feat: stream MCP chat into the client"

---

### Task 6: Document, exercise, and verify the integrated workflow

**Files:**
- Modify: README.md
- Modify only if verification finds a concrete integration defect.

- [ ] Step 1: Document both launch modes

Add exact commands:

    bun install
    bun run build
    bun run start:server -- /path/to/server.js
    bun run start:api
    cd client && bun install && bun run dev

Document that the API runs on http://127.0.0.1:8787, the Vite app proxies /api, and the inspector Connect form accepts local .js/.py paths or remote MCP URLs.

- [ ] Step 2: Run the full automated suite

    bun test
    bun run build
    cd client
    bun test
    bun run typecheck
    bun run build

Expected: root tests/build and client tests/typecheck/build all exit 0; no generated TypeScript artifacts appear beside source files.

- [ ] Step 3: Exercise API-only routes

Start the API with a test-safe environment, then verify:

    curl http://127.0.0.1:8787/api/health
    curl http://127.0.0.1:8787/api/status
    curl -X POST http://127.0.0.1:8787/api/chat -H 'content-type: application/json' -d '{"message":"hello"}'

Expected: health is { "ok": true }, status is disconnected or connected with the stable shape, and disconnected chat returns 409 without exposing secrets.

- [ ] Step 4: Exercise the browser flow

Run the API and Vite dev servers, connect through the inspector, confirm live tools/server metadata, send a message, observe assistant text and tool cards stream, disconnect, and confirm the offline/error presentation. Check desktop and 390px layouts and no console errors.

- [ ] Step 5: Run diff/working-tree checks and commit docs

    git diff --check
    git status --short
    git add README.md
    git commit -m "docs: document MCP API and client workflow"

---

## Plan self-review

- Spec coverage: shared service/CLI compatibility is Task 1; API contract and validation are Task 2; browser SSE parsing/proxy are Task 3; connection form/status are Task 4; streamed chat/tool state is Task 5; documentation and all validation paths are Task 6.
- Placeholder scan: no unfinished marker or undefined implementation step remains.
- Type consistency: MCPStreamEvent is defined in Task 1, serialized by Task 2, mirrored as ApiStreamEvent in Task 3, and consumed by App.handleSend in Task 5. MCPConnectionStatus maps to ApiStatus and then inspector props in Task 4.
- Scope: the plan covers one integration subsystem with a local loopback API; auth, persistence, and deployment remain explicitly out of scope.
