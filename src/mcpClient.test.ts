import { expect, test } from "bun:test";

import { MCPClient } from "./mcpClient.js";

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
