import { expect, test } from "bun:test";
import type { Tool as MCPTool } from "@modelcontextprotocol/client";

import { toGeminiFunctionDeclaration } from "./tooling";

test("maps an MCP tool to a Gemini function declaration", () => {
    const mcpTool = {
        name: "search",
        description: "Search for a value",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
            },
            required: ["query"],
        },
    } satisfies MCPTool;

    expect(toGeminiFunctionDeclaration(mcpTool)).toEqual({
        name: "search",
        description: "Search for a value",
        parametersJsonSchema: mcpTool.inputSchema,
    });
});
