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

test("accepts both Vite loopback development origins", async () => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
        const response = await request(createClient(), "/api/health", {
            headers: { origin },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    }
});

test("rejects a hostile Origin before a mutation reaches the MCP client", async () => {
    let cleanupCalls = 0;
    let connectCalls = 0;
    const client = createClient({ ...disconnectedStatus });
    client.cleanup = async () => { cleanupCalls += 1; };
    client.connectToServer = async () => {
        connectCalls += 1;
        return disconnectedStatus;
    };

    const response = await request(client, "/api/connect", {
        method: "POST",
        headers: {
            origin: "https://evil.example.test",
            "content-type": "application/json",
        },
        body: JSON.stringify({ serverType: "remote", serverPath: "https://mcp.example.test" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Origin is not allowed" });
    expect(cleanupCalls).toBe(0);
    expect(connectCalls).toBe(0);
});

test("allows originless CLI mutations and leaves replacement cleanup to MCPClient", async () => {
    let cleanupCalls = 0;
    let connectCalls = 0;
    const client = createClient({ ...disconnectedStatus });
    client.cleanup = async () => { cleanupCalls += 1; };
    client.connectToServer = async () => {
        connectCalls += 1;
        return disconnectedStatus;
    };

    const response = await request(client, "/api/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverType: "remote", serverPath: "https://mcp.example.test" }),
    });

    expect(response.status).toBe(200);
    expect(cleanupCalls).toBe(0);
    expect(connectCalls).toBe(1);
});

test("mutations require an application/json content type", async () => {
    for (const [path, body] of [
        ["/api/connect", { serverType: "remote", serverPath: "https://mcp.example.test" }],
        ["/api/disconnect", {}],
        ["/api/chat", { message: "hello" }],
    ] as const) {
        const response = await request(createClient(), path, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: JSON.stringify(body),
        });

        expect(response.status).toBe(415);
        expect(await response.json()).toEqual({ error: "Content-Type must be application/json" });
    }
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

test("chat streams service events and closes after completion", async () => {
    const connectedStatus = { ...disconnectedStatus, connected: true };
    const client = createClient(connectedStatus);
    client.streamQuery = async function* () {
        yield { type: "assistant-text", text: "hello" };
        yield { type: "complete", text: "hello" };
    };

    const response = await request(client, "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toBe(
        "event: assistant-text\ndata: {\"type\":\"assistant-text\",\"text\":\"hello\"}\n\n" +
        "event: complete\ndata: {\"type\":\"complete\",\"text\":\"hello\"}\n\n"
    );
});

test("chat turns an un-aborted stream failure into an error event", async () => {
    const connectedStatus = { ...disconnectedStatus, connected: true };
    const client = createClient(connectedStatus);
    client.streamQuery = async function* () {
        throw new Error("model failed");
    };

    const response = await request(client, "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
    });

    expect(await response.text()).toBe("event: error\ndata: {\"message\":\"Chat stream failed\"}\n\n");
});

test("formats a named server-sent event with JSON data and a blank line", () => {
    expect(formatSseEvent("assistant-text", { text: "hi" })).toBe(
        "event: assistant-text\ndata: {\"text\":\"hi\"}\n\n"
    );
});
