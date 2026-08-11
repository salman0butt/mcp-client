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

Run the Express HTTP API:

```bash
bun run start:api
```

The API listens on `http://127.0.0.1:8788` by default. Set `API_PORT` to use
another valid local port. The API exposes health and status JSON endpoints and
streams chat responses from `POST /api/chat` as server-sent events. The
disconnected chat response is HTTP 409; it does not invoke Gemini or an MCP
server.

Set `GOOGLE_API_KEY` to use live CLI or API chat. The API can still start
without it, and health, status, and disconnected-chat checks remain available
until a live chat request is made.

Run the browser client in a second terminal:

```bash
cd client && bun install && bun run dev
```

The Vite development server proxies `/api` to
`http://127.0.0.1:8788`, so the browser uses relative API URLs and does not
need a separate API origin configuration.

If your MCP server is already running on port `8787`, keep it there and use
the client API on its default `8788`. In the inspector, select **Remote** and
enter `http://127.0.0.1:8787/mcp`. For a custom API port, use the same
`API_PORT` value when starting both the API and Vite:

```bash
API_PORT=8790 bun run start:api
cd client && API_PORT=8790 bun run dev
```

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

## Test with the included math MCP server

The repository includes a dependency-free local MCP server at
`examples/math-server.js`. It exposes `add`, `subtract`, `multiply`, and
`divide` so you can verify the full connection and tool-calling flow without
another MCP project.

Start the API and client as described above, then enter this path in the
inspector with **Local** selected:

```text
./examples/math-server.js
```

After connecting, the inspector should show the four live math tools. With a
`GOOGLE_API_KEY` configured, try messages such as `What is 12 times 7?` or
`Divide 144 by 12.` The conversation, tool cards, server name, transport, and
tool catalog shown in the UI all come from the live API/MCP connection.

To exercise the MCP server directly without Gemini:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"add","arguments":{"a":12,"b":30}}}' \
  | node examples/math-server.js
```

The second response contains `42`.

For the MCP Inspector connection form, use a filesystem path for a local
JavaScript/Python server and a URL for a remote MCP server. Do not enter a
local filesystem path as a remote URL, or a remote URL as a local path.

## API smoke checks

With the API running, these checks are safe without an MCP server connection:

```bash
curl http://127.0.0.1:8788/api/health
curl http://127.0.0.1:8788/api/status
curl -X POST http://127.0.0.1:8788/api/chat \
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
bun run test
bun run typecheck
bun run build
```

The root suite is discovered by Bun. Use the configured `bun run test` Vitest
script for the client because direct Bun discovery misses the repository's
`*.vitest.ts` and `*.vitest.tsx` filenames.
