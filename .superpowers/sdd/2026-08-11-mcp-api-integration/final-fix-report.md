# MCP API integration final remediation report

## Scope

Remediated the final whole-branch review findings on top of `0c9d885` without
changing `.env`, the root `bun.lock`, API route names, loopback binding, or the
client's multiple tool-card array behavior.

## Root causes and fixes

1. **CORS and mutation media type**
   - Cause: CORS only conditionally emitted a response header; it did not
     authorize requests. JSON bodies were parsed irrespective of the
     `Content-Type` header.
   - Fix: reject any supplied origin except `http://localhost:5173` and
     `http://127.0.0.1:5173` before route dispatch, while allowing originless
     CLI/curl requests. POST requests now require `application/json` (including
     parameterized forms). The API connect route no longer duplicates the
     replacement cleanup already owned by `MCPClient.connectToServer`.

2. **Gemini startup without credentials**
   - Cause: `GOOGLE_API_KEY` was read and validated at module import time.
   - Fix: `MCPClient` now creates `GoogleGenAI` lazily from `getGemini()` when a
     CLI/API query first needs it. Status and connection lifecycle can start
     without a key; a chat attempt reports the existing safe missing-key error.

3. **CLI local argument classification**
   - Cause: `src/index.ts` hard-coded every argument as a remote transport.
   - Fix: `inferServerType()` classifies an absolute URL as remote and all other
     arguments as local, preserving remote URLs and allowing documented `.js` /
     `.py` paths. The CLI entrypoint is guarded so its classifier can be tested
     without launching readline.

4. **Abort propagation**
   - Cause: browser cancellation ended only the HTTP response consumption; the
     server never received a signal to stop model/tool work.
   - Fix: `/api/chat` creates an `AbortController` tied to response closure and
     passes its signal to `streamQuery`. `streamQuery` passes it to Gemini's
     `generateContentStream` config and MCP `callTool` options, checks it before
     calls/writes, and emits no further stream event after abort.

5. **MCP connection lifecycle**
   - Cause: unexpected transport closure did not clear status, while a throwing
     `mcp.close()` skipped state reset.
   - Fix: wrap the SDK-owned transport close callback after connect, preserving
     it and resetting only when that exact transport is still active. Cleanup
     resets connection state in `finally`.

6. **Streamed multi-tool calls**
   - Cause: each streaming chunk overwrote the prior model `Content`; id-less
     same-name calls reused the tool name as the client card ID.
   - Fix: aggregate all streamed candidate content parts for the next Gemini
     turn. Tool events use deterministic, per-stream presentation IDs while
     `functionResponse` continues to use the original protocol function-call ID.

7. **Browser SSE parser**
   - Cause: parsed payloads were spread after the framing type, allowing a
     payload `type` to override the SSE event name; primitives were accepted.
   - Fix: require a JSON object payload and spread it before assigning the
     canonical framing type.

8. **Documentation**
   - README now states that `GOOGLE_API_KEY` is needed for live chat, while
     health, status, and disconnected checks work without it.

## RED evidence

Focused regression tests were added before production changes and run together.
They failed as expected on the prior source:

- 10 backend failures: import without a key exited at module load; active
  transport closure and throwing cleanup left the client connected; only the
  last streamed function content survived; abort still yielded a tool result;
  CLI classification was absent; hostile origins and `text/plain` mutations
  were accepted; duplicate API cleanup ran.
- 2 client failures: payload `type` overrode the SSE frame and a string payload
  resolved instead of rejecting.
- Existing focused tests remained passing, confirming the failures were tied to
  the requested missing behavior rather than broken test setup.

## GREEN and verification evidence

Focused GREEN runs:

```text
bun test src/api.test.ts                 13 pass, 0 fail
bun test src/mcpClient.test.ts             9 pass, 0 fail
bun test src/index.test.ts                 1 pass, 0 fail
cd client && bun run test -- src/api/client.vitest.ts
                                            4 pass, 0 fail
```

Fresh full verification completed successfully:

```text
bun test                                24 pass, 0 fail
bun run build                            exit 0
cd client && bun run test               20 pass, 0 fail
cd client && bun run typecheck           exit 0
cd client && bun run build               exit 0
git diff --check                         exit 0
```

## Changed files

- `src/api.ts`, `src/api.test.ts`
- `src/mcpClient.ts`, `src/mcpClient.test.ts`
- `src/index.ts`, `src/index.test.ts`
- `client/src/api/sse.ts`, `client/src/api/client.vitest.ts`
- `README.md`
- This report

## Limitations

The installed Gemini SDK documents `abortSignal` as client-side cancellation:
it stops local request/response consumption, but a request already accepted by
the Gemini service can still incur usage. MCP cancellation is forwarded through
the installed client SDK; the remote MCP server ultimately controls whether it
can interrupt an already-running tool. No credentials, environment files,
generated TypeScript artifacts, web framework, authentication, persistence, or
browser MCP process spawning were added.
