import express, { type NextFunction, type Request, type Response } from "express";
import * as http from "node:http";
import { pathToFileURL } from "node:url";

import { MCPClient } from "./mcpClient.js";

const MAX_BODY_BYTES = 1_048_576;
export const DEFAULT_API_PORT = 8788;
const VITE_DEV_ORIGINS = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]);

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

export function createApiApp(client: MCPClient): express.Express {
    const app = express();
    app.disable("x-powered-by");

    app.use((request, response, next) => {
        try {
            authorizeOrigin(request, response);
            if (request.method === "OPTIONS") {
                response.status(204).set({
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                }).end();
                return;
            }
            if (request.method === "POST") {
                requireJsonContentType(request);
            }
            next();
        } catch (error) {
            next(error);
        }
    });
    app.use(express.json({ limit: MAX_BODY_BYTES }));

    app.get("/api/health", (_request, response) => {
        sendJson(response, 200, { ok: true });
    });

    app.get("/api/status", (_request, response) => {
        sendJson(response, 200, client.getStatus());
    });

    app.post("/api/connect", async (request, response) => {
        const payload = validateConnectPayload(request.body);
        await client.connectToServer(payload.serverPath, payload.serverType);
        sendJson(response, 200, client.getStatus());
    });

    app.post("/api/disconnect", async (_request, response) => {
        await client.cleanup();
        sendJson(response, 200, client.getStatus());
    });

    app.post("/api/chat", async (request, response) => {
        const message = getMessage(request.body);
        if (!client.getStatus().connected) {
            throw new RequestError(409, "MCP server is not connected");
        }

        const abortController = new AbortController();
        const abortOnResponseClose = () => abortController.abort();
        const abortOnSocketClose = () => abortController.abort();
        const responseSocket = response.socket;
        response.once("close", abortOnResponseClose);
        responseSocket?.once("close", abortOnSocketClose);
        response.status(200).set({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        }).flushHeaders();

        try {
            for await (const event of client.streamQuery(message, abortController.signal)) {
                if (abortController.signal.aborted) {
                    break;
                }
                response.write(formatSseEvent(event.type, event));
            }
        } catch {
            if (!abortController.signal.aborted && !response.destroyed) {
                response.write(formatSseEvent("error", { message: "Chat stream failed" }));
            }
        } finally {
            response.off("close", abortOnResponseClose);
            responseSocket?.off("close", abortOnSocketClose);
            if (!response.writableEnded) {
                response.end();
            }
        }
    });

    app.use((_request, response) => {
        sendJson(response, 404, { error: "Not found" });
    });

    app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
        if (response.headersSent) {
            response.end();
            return;
        }

        const requestError = normalizeRequestError(error);
        if (requestError) {
            sendJson(response, requestError.statusCode, { error: requestError.message });
            return;
        }
        sendJson(response, 500, { error: "Internal server error" });
    });

    return app;
}

export function createApiServer(client: MCPClient): http.Server {
    return http.createServer(createApiApp(client));
}

export function resolveApiPort(value: string | undefined): number {
    const apiPort = Number.parseInt(value ?? String(DEFAULT_API_PORT), 10);
    return Number.isSafeInteger(apiPort) && apiPort > 0 && apiPort <= 65535 ? apiPort : DEFAULT_API_PORT;
}

export function startApiServer(): http.Server {
    const port = resolveApiPort(process.env.API_PORT);
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

function getMessage(value: unknown): string {
    if (!isRecord(value) || typeof value.message !== "string" || !value.message.trim()) {
        throw new RequestError(400, "Message is required");
    }
    return value.message.trim();
}

function authorizeOrigin(request: Request, response: Response): void {
    const origin = request.headers.origin;
    if (!origin) {
        return;
    }
    if (!VITE_DEV_ORIGINS.has(origin)) {
        throw new RequestError(403, "Origin is not allowed");
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
}

function requireJsonContentType(request: Request): void {
    const contentType = request.headers["content-type"];
    const mediaType = Array.isArray(contentType) ? contentType[0] : contentType;
    if (mediaType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
        throw new RequestError(415, "Content-Type must be application/json");
    }
}

function sendJson(response: Response, statusCode: number, payload: unknown): void {
    response.status(statusCode).type("application/json").send(payload);
}

function normalizeRequestError(error: unknown): RequestError | null {
    if (error instanceof RequestError) {
        return error;
    }
    if (isRecord(error) && error.type === "entity.too.large") {
        return new RequestError(413, "Request body is too large");
    }
    if (isRecord(error) && error.type === "entity.parse.failed") {
        return new RequestError(400, "Invalid JSON body");
    }
    return null;
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
