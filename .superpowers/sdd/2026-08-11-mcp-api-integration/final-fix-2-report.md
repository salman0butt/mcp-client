# Final MCP remediation gaps report

## Scope

Follow-up remediation on top of `a289a9f`. This change is limited to Windows
CLI transport classification, production-runtime HTTP chat cancellation, their
focused tests, and this report. Existing `.env` and root `bun.lock` were not
modified.

## Root causes and fixes

### Windows CLI paths

`new URL("C:\\mcp\\server.py")` succeeds by treating `c:` as a URL scheme, so
`inferServerType()` incorrectly returned `remote`. It now checks a Windows
drive-letter prefix (`^[a-zA-Z]:[\\\\/]`) before URL parsing and returns
`local`. Existing absolute HTTP(S) URL behavior remains unchanged.

### HTTP client disconnects

The API already connected `ServerResponse.close` to the chat abort controller,
but a real Node loopback client socket reset is reliably exposed through the
response socket's `close` event. The API now registers that socket-close event
before writing SSE headers and removes it in `finally`, alongside the response
listener. Both handlers abort the same per-chat controller; normal completed
responses remove the listeners before `response.end()`.

The Bun test HTTP implementation does not surface a peer reset to a live
stream in the same way as the shipped Node API. The integration test therefore
builds the API and runs a small Node child process with `createApiServer`, a
fake async stream, and a raw loopback HTTP client. It destroys the client
socket after the first SSE bytes and asserts that the fake stream's signal
becomes aborted. This exercises the actual `start:api` runtime without
weakening the client-disconnect assertion.

## RED evidence

Before production fixes:

```text
bun test src/index.test.ts src/api.test.ts

Windows path: expected "local", received "remote" for C:\\mcp\\server.py
HTTP disconnect: expected signalWasAborted true, received false
```

The initial abort integration test ran its API server under Bun. A separate
compiled Node trace confirmed that a real socket reset produces
`server-socket-close` and `stream-signal-aborted true`; that identified the
runtime boundary needed for the final deterministic test and socket listener.

## GREEN evidence

Focused regression verification:

```text
bun test src/index.test.ts src/api.test.ts
15 pass, 0 fail
```

Full verification:

```text
bun test                                25 pass, 0 fail
bun run build                            exit 0
cd client && bun run test               20 pass, 0 fail
cd client && bun run typecheck           exit 0
cd client && bun run build               exit 0
git diff --check                         exit 0
```

## Changed files

- `src/index.ts`
- `src/index.test.ts`
- `src/api.ts`
- `src/api.test.ts`
- `.superpowers/sdd/2026-08-11-mcp-api-integration/final-fix-2-report.md`
