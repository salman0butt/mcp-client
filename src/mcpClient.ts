import { GoogleGenAI, type Content, type FunctionCall, type Part } from "@google/genai";
import {
    Client,
    StreamableHTTPClientTransport,
    Transport,
    type Tool as MCPTool,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { toGeminiFunctionDeclaration } from "./tooling.js";

type ServerType = "local" | "remote";
type MCPTransport = StdioClientTransport | StreamableHTTPClientTransport;

export interface MCPConnectionStatus {
    connected: boolean;
    serverType: ServerType | null;
    serverPath: string | null;
    serverName: string | null;
    transport: "stdio" | "streamable-http" | null;
    model: string;
    tools: MCPTool[];
}

export type MCPStreamEvent =
    | { type: "assistant-text"; text: string }
    | { type: "tool-start"; id: string; name: string; args: Record<string, unknown> }
    | {
          type: "tool-result";
          id: string;
          name: string;
          content: unknown;
          isError: boolean;
          durationMs: number;
      }
    | { type: "complete"; text: string };

export class MCPClient {
    private mcp: Client;
    private gemini: GoogleGenAI | null = null;
    private model: string;
    private transport: MCPTransport | null = null;
    private tools: MCPTool[] = [];
    private serverType: ServerType | null = null;
    private serverPath: string | null = null;
    private serverName: string | null = null;

    constructor() {
        this.model = process.env.LLM_MODEL || "gemini-2.5-flash";
        this.mcp = new Client({ name: "cg-mcp-client", version: "1.0.0" });
    }

    getStatus(): MCPConnectionStatus {
        return {
            connected: this.transport !== null,
            serverType: this.serverType,
            serverPath: this.serverPath,
            serverName: this.serverName,
            transport: this.transport instanceof StdioClientTransport
                ? "stdio"
                : this.transport instanceof StreamableHTTPClientTransport
                    ? "streamable-http"
                    : null,
            model: this.model,
            tools: this.transport ? this.tools : [],
        };
    }

    async connectToServer(serverPath: string, serverType: ServerType): Promise<MCPConnectionStatus> {
        let transport: MCPTransport;
        if (serverType === "local") {
            const isJs = serverPath.endsWith(".js");
            const isPy = serverPath.endsWith(".py");
            if (!isJs && !isPy) {
                throw new Error("Server script must be a .js or .py file");
            }
            const command = isPy
                ? process.platform === "win32"
                    ? "python"
                    : "python3"
                : process.execPath;
            transport = new StdioClientTransport({ command, args: [serverPath] });
        } else {
            transport = new StreamableHTTPClientTransport(new URL(serverPath));
        }

        await this.cleanup();
        this.transport = transport;
        try {
            await this.mcp.connect(transport as Transport);
            this.watchTransportClose(transport);
            const toolsResult = await this.mcp.listTools();
            if (this.transport !== transport) {
                throw new Error("MCP transport closed during connection setup");
            }

            this.tools = toolsResult.tools;
            this.serverType = serverType;
            this.serverPath = serverPath;
            this.serverName = this.mcp.getServerVersion()?.name ?? null;
            console.log("Connected to server with tools:", this.tools.map(({ name }) => name));
            return this.getStatus();
        } catch (error) {
            console.log("Failed to connect to MCP server: ", error);
            await this.cleanup();
            throw error;
        }
    }

    async processQuery(query: string): Promise<string> {
        const gemini = this.getGemini();
        const systemInstruction = `You are a smart chatbot. You have access to the following MCP tools:
${this.tools.map((tool) => tool.name).join("\n")}`;
        const contents: Content[] = [{ role: "user", parts: [{ text: query }] }];
        const functionDeclarations = this.tools.map(toGeminiFunctionDeclaration);
        const finalText: string[] = [];

        while (true) {
            const response = await gemini.models.generateContent({
                model: this.model,
                contents,
                config: {
                    systemInstruction,
                    ...(functionDeclarations.length > 0 ? { tools: [{ functionDeclarations }] } : {}),
                },
            });
            const responseContent = response.candidates?.[0]?.content;
            const functionCalls = response.functionCalls;

            if (response.text) {
                finalText.push(response.text);
            }
            if (!functionCalls?.length) {
                return finalText.join("\n");
            }
            if (responseContent) {
                contents.push(responseContent);
            }
            const functionResponses = await this.callTools(functionCalls, finalText);
            contents.push({ role: "user", parts: functionResponses });
        }
    }

    async *streamQuery(query: string, signal?: AbortSignal): AsyncGenerator<MCPStreamEvent> {
        if (signal?.aborted) {
            return;
        }
        const gemini = this.getGemini();
        const systemInstruction = `You are a smart chatbot. You have access to the following MCP tools:
${this.tools.map((tool) => tool.name).join("\n")}`;
        const contents: Content[] = [{ role: "user", parts: [{ text: query }] }];
        const functionDeclarations = this.tools.map(toGeminiFunctionDeclaration);
        const finalText: string[] = [];
        let nextToolEventId = 0;

        while (true) {
            if (signal?.aborted) {
                return;
            }
            const response = await gemini.models.generateContentStream({
                model: this.model,
                contents,
                config: {
                    systemInstruction,
                    ...(signal ? { abortSignal: signal } : {}),
                    ...(functionDeclarations.length > 0 ? { tools: [{ functionDeclarations }] } : {}),
                },
            });
            const functionCalls: FunctionCall[] = [];
            const responseParts: Part[] = [];
            let responseRole: Content["role"] | undefined;

            for await (const chunk of response) {
                if (signal?.aborted) {
                    return;
                }
                if (chunk.text) {
                    finalText.push(chunk.text);
                    yield { type: "assistant-text", text: chunk.text };
                }
                const chunkContent = chunk.candidates?.[0]?.content;
                if (chunkContent?.parts?.length) {
                    responseRole ??= chunkContent.role;
                    responseParts.push(...chunkContent.parts);
                }
                if (chunk.functionCalls?.length) {
                    functionCalls.push(...chunk.functionCalls);
                }
            }

            if (signal?.aborted) {
                return;
            }
            if (!functionCalls.length) {
                yield { type: "complete", text: finalText.join("") };
                return;
            }
            if (responseParts.length) {
                contents.push({ role: responseRole ?? "model", parts: responseParts });
            }

            const functionResponses: Part[] = [];
            for (const functionCall of functionCalls) {
                if (signal?.aborted) {
                    return;
                }
                if (!functionCall.name) {
                    throw new Error("Gemini returned a function call without a name");
                }
                const id = `tool-call-${nextToolEventId++}`;
                const args = (functionCall.args ?? {}) as Record<string, unknown>;
                yield { type: "tool-start", id, name: functionCall.name, args };

                if (signal?.aborted) {
                    return;
                }
                const start = performance.now();
                const result = await this.mcp.callTool(
                    { name: functionCall.name, arguments: args },
                    signal ? { signal } : undefined
                );
                const durationMs = Math.round(performance.now() - start);
                if (signal?.aborted) {
                    return;
                }
                yield {
                    type: "tool-result",
                    id,
                    name: functionCall.name,
                    content: result.content,
                    isError: result.isError === true,
                    durationMs,
                };
                functionResponses.push(this.functionResponse(functionCall, result));
            }
            contents.push({ role: "user", parts: functionResponses });
        }
    }

    async cleanup(): Promise<void> {
        try {
            if (this.transport) {
                await this.mcp.close();
            }
        } finally {
            this.resetConnection();
        }
    }

    private getGemini(): GoogleGenAI {
        if (!this.gemini) {
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) {
                throw new Error("GOOGLE_API_KEY is not set");
            }
            this.gemini = new GoogleGenAI({ apiKey });
        }
        return this.gemini;
    }

    private watchTransportClose(transport: MCPTransport): void {
        const previousOnClose = transport.onclose;
        transport.onclose = () => {
            previousOnClose?.();
            if (this.transport === transport) {
                this.resetConnection();
            }
        };
    }

    private resetConnection(): void {
        this.transport = null;
        this.tools = [];
        this.serverType = null;
        this.serverPath = null;
        this.serverName = null;
    }

    private async callTools(functionCalls: FunctionCall[], finalText: string[]): Promise<Part[]> {
        const functionResponses: Part[] = [];
        for (const functionCall of functionCalls) {
            if (!functionCall.name) {
                throw new Error("Gemini returned a function call without a name");
            }
            const toolArgs = (functionCall.args ?? {}) as Record<string, unknown>;
            const result = await this.mcp.callTool({ name: functionCall.name, arguments: toolArgs });
            finalText.push(`[Calling tool ${functionCall.name} with args ${JSON.stringify(toolArgs)}]`);
            functionResponses.push(this.functionResponse(functionCall, result));
        }
        return functionResponses;
    }

    private functionResponse(functionCall: { id?: string; name?: string }, result: Awaited<ReturnType<Client["callTool"]>>): Part {
        return {
            functionResponse: {
                id: functionCall.id,
                name: functionCall.name ?? "",
                response: {
                    content: result.content,
                    ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}),
                    ...(result.isError ? { isError: true } : {}),
                },
            },
        };
    }
}
