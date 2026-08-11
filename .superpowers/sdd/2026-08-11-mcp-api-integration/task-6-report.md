# Task 6 report: MCP API and client workflow

Date: 2026-08-11
Base commit: `de837b5`

## Changed files

- `README.md`: documented the exact install, build, CLI, API, and Vite launch
  commands; API loopback/proxy behavior; inspector local `.js`/`.py` versus
  remote URL guidance; API smoke checks; and the client test-discovery note.
- No source files were changed. No `.env`, root `bun.lock`, or generated
  TypeScript artifacts were modified or added.

## Automated verification

All commands below were run fresh.

- `bun test` (repository root): exit 0; 11 tests passed, 0 failed, 17
  assertions.
- `bun run build` (repository root): exit 0; TypeScript build completed.
- `cd client && bun test`: exit 1, `No tests found!`. This is the expected
  discovery mismatch: the direct Bun runner does not discover the client
  `*.vitest.ts`/`*.vitest.tsx` files.
- `cd client && bun run test`: exit 0; configured `vitest run` completed with
  2 test files and 18 tests passed.
- `cd client && bun run typecheck`: exit 0; both client TypeScript projects
  passed.
- `cd client && bun run build`: exit 0; typecheck and Vite production build
  completed (`1805 modules transformed`).
- `find dist client/dist -type f \( -name '*.ts' -o -name '*.tsx' \)`: no
  generated TypeScript artifacts found in build outputs.
- `git diff --check`: exit 0; no whitespace errors.

## API-only verification

The first `bun run start:api` attempt failed before listening because the
shared MCP client requires `GOOGLE_API_KEY` at import time. No secret was
read, printed, or changed. The safe retry used the non-secret temporary value
`GOOGLE_API_KEY=test-only` only in the process environment.

Port 8787 was already occupied by PID 52004, an unrelated Node process. Its
responses were plain 404s, not this API, so it was not terminated. The API was
started safely with `API_PORT=18787` and tested there:

- `curl -i http://127.0.0.1:18787/api/health`: HTTP 200; redacted body
  `{ "ok": true }`.
- `curl -i http://127.0.0.1:18787/api/status`: HTTP 200; disconnected stable
  shape with `connected: false`, null server identity/transport fields,
  model `gemini-2.5-flash`, and an empty `tools` array.
- `curl -i -X POST http://127.0.0.1:18787/api/chat -H
  'content-type: application/json' -d '{"message":"hello"}'`: HTTP 409;
  redacted body `{ "error": "MCP server is not connected" }`.

The API process was stopped after the probes. No MCP server connection or
Gemini request was attempted.

## Browser-flow verification and limitation

The Vite server was run with `bun run dev -- --host 127.0.0.1` and the local
client was inspected in the browser:

- Desktop view loaded with the seeded disconnected conversation, inspector
  connection form, local path guidance, disabled disconnected composer, and
  no browser console errors.
- A 390px by 844px viewport loaded with the mobile navigation drawer control,
  hidden inspector control, conversation, and disconnected composer without a
  visible layout failure.

The full live connect/stream/disconnect browser flow was not possible in this
run. The Vite proxy is fixed to port 8787, which was occupied by the unrelated
404-serving Node process; the verified API used 18787. No credentials or
external MCP URL were available or used. The API-only checks above are the
safest available proxy/API validation under that limitation.

## Working tree

Before commit, `git status --short` showed:

```text
 M README.md
?? .env
?? bun.lock
```

The untracked `.env` and root `bun.lock` pre-existed and were intentionally
left untouched and excluded from the commit.
