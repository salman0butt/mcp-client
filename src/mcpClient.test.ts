import { expect, test } from "bun:test";

import { MCPClient } from "./mcpClient.js";

function streamFrom<T>(chunks: T[]): AsyncGenerator<T> {
    return (async function* () {
        yield* chunks;
    })();
}

function privateState(client: MCPClient): Record<string, any> {
    return client as unknown as Record<string, any>;
}

test("imports without a Google API key and reports the missing key only when chat starts", () => {
    const result = Bun.spawnSync({
        cmd: [
            process.execPath,
            "-e",
            `delete process.env.GOOGLE_API_KEY;
const { MCPClient } = await import("./src/mcpClient.ts");
const client = new MCPClient();
console.log(client.getStatus().connected ? "connected" : "imported");
try {
    await client.processQuery("hello");
} catch (error) {
    console.log(error instanceof Error ? error.message : String(error));
}`,
        ],
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(new TextDecoder().decode(result.stdout).trim().split("\n")).toEqual([
        "imported",
        "GOOGLE_API_KEY is not set",
    ]);
});

test("rejects local server paths that are not JavaScript or Python files", async () => {
    const client = new MCPClient();

    await expect(client.connectToServer("server.txt", "local")).rejects.toThrow(
        "Server script must be a .js or .py file"
    );
});

test("rejects remote server paths that are not absolute URLs", async () => {
    const client = new MCPClient();

    await expect(client.connectToServer("not-a-url", "remote")).rejects.toThrow();
});

test("returns an empty disconnected status before a server is connected", () => {
    const client = new MCPClient();

    expect(client.getStatus()).toEqual({
        connected: false,
        serverType: null,
        serverPath: null,
        serverName: null,
        transport: null,
        model: process.env.LLM_MODEL || "gemini-2.5-flash",
        tools: [],
    });
});

test("clears the connection when the active transport closes unexpectedly", async () => {
    const client = new MCPClient();
    const state = privateState(client);
    const transports: Array<{ onclose?: () => void }> = [];
    state.mcp = {
        connect: async (transport: { onclose?: () => void }) => {
            transports.push(transport);
        },
        listTools: async () => ({ tools: [] }),
        getServerVersion: () => ({ name: "Test MCP" }),
        close: async () => {},
    };

    await client.connectToServer("https://mcp.example.test", "remote");
    transports[0]?.onclose?.();

    expect(client.getStatus()).toMatchObject({
        connected: false,
        serverType: null,
        serverPath: null,
        serverName: null,
        tools: [],
    });
});

test("ignores a stale transport close after a replacement connection", async () => {
    const client = new MCPClient();
    const state = privateState(client);
    const transports: Array<{ onclose?: () => void }> = [];
    state.mcp = {
        connect: async (transport: { onclose?: () => void }) => {
            transports.push(transport);
        },
        listTools: async () => ({ tools: [] }),
        getServerVersion: () => ({ name: "Test MCP" }),
        close: async () => {},
    };

    await client.connectToServer("https://first.example.test", "remote");
    await client.connectToServer("https://second.example.test", "remote");
    transports[0]?.onclose?.();

    expect(client.getStatus()).toMatchObject({
        connected: true,
        serverPath: "https://second.example.test",
    });
});

test("clears connection state even when MCP cleanup fails", async () => {
    const client = new MCPClient();
    const state = privateState(client);
    state.transport = {};
    state.tools = [{ name: "search" }];
    state.serverType = "remote";
    state.serverPath = "https://mcp.example.test";
    state.serverName = "Test MCP";
    state.mcp = { close: async () => { throw new Error("close failed"); } };

    await expect(client.cleanup()).rejects.toThrow("close failed");
    expect(client.getStatus()).toMatchObject({
        connected: false,
        serverType: null,
        serverPath: null,
        serverName: null,
        tools: [],
    });
});

test("keeps all streamed function-call parts and uses distinct presentation IDs", async () => {
    const client = new MCPClient();
    const state = privateState(client);
    const requests: Array<Record<string, any>> = [];
    let turn = 0;
    state.gemini = {
        models: {
            generateContentStream: async (request: Record<string, any>) => {
                requests.push(request);
                turn += 1;
                return turn === 1
                    ? streamFrom([
                        {
                            functionCalls: [{ id: "protocol-a", name: "search", args: { query: "a" } }],
                            candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "protocol-a", name: "search", args: { query: "a" } } }] } }],
                        },
                        {
                            functionCalls: [{ name: "search", args: { query: "b" } }],
                            candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "search", args: { query: "b" } } }] } }],
                        },
                    ])
                    : streamFrom([{ text: "done" }]);
            },
        },
    };
    state.mcp = {
        callTool: async () => ({ content: [] }),
    };

    const events = [];
    for await (const event of client.streamQuery("find things")) {
        events.push(event);
    }

    const toolStarts = events.filter((event) => event.type === "tool-start");
    const modelResponse = requests[1]?.contents[1];
    const functionResponses = requests[1]?.contents[2]?.parts;

    expect(toolStarts).toHaveLength(2);
    expect(toolStarts[0]?.id).not.toBe(toolStarts[1]?.id);
    expect(modelResponse.parts.map((part: { functionCall: { args: { query: string } } }) => part.functionCall.args.query)).toEqual(["a", "b"]);
    expect(functionResponses.map((part: { functionResponse: { id?: string } }) => part.functionResponse.id)).toEqual(["protocol-a", undefined]);
});

test("forwards an abort signal to model and tool calls and stops before another event", async () => {
    const client = new MCPClient();
    const state = privateState(client);
    const controller = new AbortController();
    let modelSignal: AbortSignal | undefined;
    let toolSignal: AbortSignal | undefined;
    let markToolStarted: (() => void) | undefined;
    const toolStarted = new Promise<void>((resolve) => {
        markToolStarted = resolve;
    });

    state.gemini = {
        models: {
            generateContentStream: async (request: Record<string, any>) => {
                modelSignal = request.config.abortSignal;
                return streamFrom([{
                    functionCalls: [{ name: "search", args: {} }],
                    candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "search", args: {} } }] } }],
                }]);
            },
        },
    };
    state.mcp = {
        callTool: async (_params: unknown, options: { signal?: AbortSignal }) => {
            toolSignal = options?.signal;
            markToolStarted?.();
            await new Promise<void>((resolve) => controller.signal.addEventListener("abort", () => resolve(), { once: true }));
            return { content: [] };
        },
    };

    const iterator = client.streamQuery("find things", controller.signal);
    expect(await iterator.next()).toMatchObject({ value: { type: "tool-start", name: "search" } });
    const afterAbort = iterator.next();
    await toolStarted;
    controller.abort();

    expect(await afterAbort).toMatchObject({ done: true });
    expect(modelSignal).toBe(controller.signal);
    expect(toolSignal).toBe(controller.signal);
});
