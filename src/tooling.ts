import type { FunctionDeclaration } from "@google/genai";
import type { Tool as MCPTool } from "@modelcontextprotocol/client";

export function toGeminiFunctionDeclaration(
    tool: MCPTool
): FunctionDeclaration {
    return {
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.inputSchema,
    };
}
