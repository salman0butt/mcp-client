# mcp-client

This repository contains the MCP command-line client, a loopback HTTP API, and
the Vite/React client UI.

## Install and build

From the repository root:

```bash
bun install
bun run build
```

## Launch modes

Run the existing MCP CLI against a local server (JavaScript or Python):

```bash
bun run start:server -- /path/to/server.js
```

Run the HTTP API:

```bash
bun run start:api
```

The API listens on `http://127.0.0.1:8787` by default. Set `API_PORT` to use
another valid local port. The API exposes health and status JSON endpoints and
streams chat responses from `POST /api/chat` as server-sent events. The
disconnected chat response is HTTP 409; it does not invoke Gemini or an MCP
server.

Run the browser client in a second terminal:

```bash
cd client && bun install && bun run dev
```

The Vite development server proxies `/api` to
`http://127.0.0.1:8787`, so the browser uses relative API URLs and does not
need a separate API origin configuration.

## Connect workflow

1. Start the API and the Vite client.
2. Open the Vite URL shown by `bun run dev`.
3. In the inspector, choose `Local` and enter a local `.js` or `.py` server
   path, or choose `Remote` and enter an absolute MCP URL such as
   `https://example.com/mcp`.
4. Select **Connect** and wait for the live server metadata and tool catalog.
5. Send a message to observe assistant text and tool events stream into the
   conversation. Select **Disconnect** to return to the offline state.

Local paths must end in `.js` or `.py`; remote values must be absolute URLs.
The API process owns the MCP connection, while the CLI remains available
through `start:server`.

For the MCP Inspector connection form, use a filesystem path for a local
JavaScript/Python server and a URL for a remote MCP server. Do not enter a
local filesystem path as a remote URL, or a remote URL as a local path.

## API smoke checks

With the API running, these checks are safe without an MCP server connection:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/status
curl -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"hello"}'
```

Health returns `{ "ok": true }`. Status always has a stable connection shape
(`connected`, server identity/transport fields, model, and `tools`). Before a
connection is established, chat returns `409` with a generic disconnected
error.

## Tests and checks

From the repository root:

```bash
bun test
bun run build
cd client
bun test
bun run typecheck
bun run build
```

The root suite is discovered by Bun. The client suite is run through its
configured `bun run test` script (`vitest run`) because the direct Bun runner does
not discover the repository's `*.vitest.ts` and `*.vitest.tsx` files selected by
`client/vitest.config.ts`.
