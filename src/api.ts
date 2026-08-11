import * as http from "node:http";
import { pathToFileURL } from "node:url";

import { MCPClient } from "./mcpClient.js";

const MAX_BODY_BYTES = 1_048_576;
const VITE_DEV_ORIGIN = "http://localhost:5173";

export interface ConnectRequest {
    serverType: "local" | "remote";
    serverPath: string;
}

export function formatSseEvent(eventName: string, payload: unknown): string {
    return `event: ${eventName}\ndata: ${JSON.stringify(payload) ?? "null"}\n\n`;
}

export function validateConnectPayload(value: unknown): ConnectRequest {
    if (!isRecord(value) || (value.serverType !== "local" && value.serverType !== "remote") || typeof value.serverPath !== "string") {
        throw new RequestError(400, "serverType and serverPath are required");
    }

    const serverPath = value.serverPath.trim();
    if (!serverPath) {
        throw new RequestError(400, "serverPath is required");
    }
    if (value.serverType === "local" && !serverPath.endsWith(".js") && !serverPath.endsWith(".py")) {
        throw new RequestError(400, "Local server path must end in .js or .py");
    }
    if (value.serverType === "remote") {
        try {
            new URL(serverPath);
        } catch {
            throw new RequestError(400, "Remote server path must be an absolute URL");
        }
    }

    return { serverType: value.serverType, serverPath };
}

export function createApiServer(client: MCPClient): http.Server {
    return http.createServer(async (request, response) => {
        setCorsHeaders(request, response);

        if (request.method === "OPTIONS") {
            response.writeHead(204, {
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            });
            response.end();
            return;
        }

        try {
            if (request.method === "GET" && request.url === "/api/health") {
                sendJson(response, 200, { ok: true });
                return;
            }
            if (request.method === "GET" && request.url === "/api/status") {
                sendJson(response, 200, client.getStatus());
                return;
            }
            if (request.method === "POST" && request.url === "/api/connect") {
                const payload = validateConnectPayload(await readJsonBody(request));
                await client.cleanup();
                await client.connectToServer(payload.serverPath, payload.serverType);
                sendJson(response, 200, client.getStatus());
                return;
            }
            if (request.method === "POST" && request.url === "/api/disconnect") {
                await client.cleanup();
                sendJson(response, 200, client.getStatus());
                return;
            }
            if (request.method === "POST" && request.url === "/api/chat") {
                const payload = await readJsonBody(request);
                const message = getMessage(payload);
                if (!client.getStatus().connected) {
                    throw new RequestError(409, "MCP server is not connected");
                }

                response.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                });
                try {
                    for await (const event of client.streamQuery(message)) {
                        response.write(formatSseEvent(event.type, event));
                    }
                } catch {
                    response.write(formatSseEvent("error", { message: "Chat stream failed" }));
                } finally {
                    response.end();
                }
                return;
            }

            sendJson(response, 404, { error: "Not found" });
        } catch (error) {
            if (response.headersSent) {
                response.end();
                return;
            }
            if (error instanceof RequestError) {
                sendJson(response, error.statusCode, { error: error.message });
                return;
            }
            sendJson(response, 500, { error: "Internal server error" });
        }
    });
}

export function startApiServer(): http.Server {
    const apiPort = Number.parseInt(process.env.API_PORT ?? "8787", 10);
    const port = Number.isSafeInteger(apiPort) && apiPort > 0 && apiPort <= 65535 ? apiPort : 8787;
    const client = new MCPClient();
    const server = createApiServer(client);
    let isShuttingDown = false;

    const shutdown = () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        server.close(() => {
            void client.cleanup().finally(() => process.exit(0));
        });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    server.listen(port, "127.0.0.1", () => {
        console.log(`MCP API listening at http://127.0.0.1:${port}`);
    });
    return server;
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BODY_BYTES) {
            throw new RequestError(413, "Request body is too large");
        }
        chunks.push(buffer);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        throw new RequestError(400, "Invalid JSON body");
    }
}

function getMessage(value: unknown): string {
    if (!isRecord(value) || typeof value.message !== "string" || !value.message.trim()) {
        throw new RequestError(400, "Message is required");
    }
    return value.message.trim();
}

function setCorsHeaders(request: http.IncomingMessage, response: http.ServerResponse): void {
    if (request.headers.origin === VITE_DEV_ORIGIN) {
        response.setHeader("Access-Control-Allow-Origin", VITE_DEV_ORIGIN);
    }
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

class RequestError extends Error {
    constructor(readonly statusCode: number, message: string) {
        super(message);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    startApiServer();
}
