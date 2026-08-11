import { afterEach, expect, test } from "bun:test";
import type http from "node:http";

import { createApiServer, formatSseEvent } from "./api.js";
import type { MCPClient, MCPConnectionStatus, MCPStreamEvent } from "./mcpClient.js";

const disconnectedStatus: MCPConnectionStatus = {
    connected: false,
    serverType: null,
    serverPath: null,
    serverName: null,
    transport: null,
    model: "gemini-2.5-flash",
    tools: [],
};

const servers: http.Server[] = [];

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    })));
});

function createClient(status = disconnectedStatus): MCPClient {
    return {
        getStatus: () => status,
        cleanup: async () => {},
        connectToServer: async () => status,
        streamQuery: async function* (): AsyncGenerator<MCPStreamEvent> {},
    } as unknown as MCPClient;
}

async function request(client: MCPClient, path: string, init?: RequestInit): Promise<Response> {
    const server = createApiServer(client);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Expected a TCP address");
    }
    return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

test("health returns an ok response without a connection", async () => {
    const response = await request(createClient(), "/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
});

test("chat rejects a blank message before opening an event stream", async () => {
    const response = await request(createClient(), "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "   " }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Message is required" });
});

test("mutations reject malformed JSON", async () => {
    const response = await request(createClient(), "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
});

test("connect rejects local scripts without a JavaScript or Python extension", async () => {
    const response = await request(createClient(), "/api/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverType: "local", serverPath: "/tmp/server.txt" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Local server path must end in .js or .py" });
});

test("connect rejects remote paths that are not absolute URLs", async () => {
    const response = await request(createClient(), "/api/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverType: "remote", serverPath: "mcp.example.test" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Remote server path must be an absolute URL" });
});

test("chat returns conflict when no MCP server is connected", async () => {
    const response = await request(createClient(), "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "MCP server is not connected" });
});

test("formats a named server-sent event with JSON data and a blank line", () => {
    expect(formatSseEvent("assistant-text", { text: "hi" })).toBe(
        "event: assistant-text\ndata: {\"text\":\"hi\"}\n\n"
    );
});
