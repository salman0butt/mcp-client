import { GoogleGenAI, type Content, type Part } from "@google/genai";
import {
    Client,
    StreamableHTTPClientTransport,
    Transport,
    type Tool as MCPTool,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import readline from "readline/promises";

import { toGeminiFunctionDeclaration } from "./tooling.js";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
}

class MCPClient {
    private mcp: Client;
    private gemini: GoogleGenAI;
    private model: string;
    private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;
    private tools: MCPTool[] = [];

    constructor() {
        this.gemini = new GoogleGenAI({
            apiKey: GOOGLE_API_KEY,
        });
        this.model = process.env.LLM_MODEL || "gemini-2.5-flash";
        this.mcp = new Client({ name: "cg-mcp-client", version: "1.0.0" });
    }
    // methods will go here

    async connectToServer(serverScriptPath: string, serverType: "local" | "remote") {
        if (serverType === 'local') {
            const isJs = serverScriptPath.endsWith(".js");
            const isPy = serverScriptPath.endsWith(".py");
            if (!isJs && !isPy) {
                throw new Error("Server script must be a .js or .py file");
            }
            const command = isPy
                ? process.platform === "win32"
                    ? "python"
                    : "python3"
                : process.execPath;

            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            });
        } else if (serverType === 'remote') {
            // Streamble http transport
            const url = new URL(serverScriptPath);
            this.transport = new StreamableHTTPClientTransport(url);
        }

        try {

            await this.mcp.connect(this.transport as Transport);

            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools;
            console.log(
                "Connected to server with tools:",
                this.tools.map(({ name }) => name)
            );
        } catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    async processQuery(query: string): Promise<string> {
        const systemInstruction = `You are a smart chatbot. You have access to the following MCP tools:
${this.tools.map((tool) => tool.name).join("\n")}`;
        const contents: Content[] = [
            {
                role: "user",
                parts: [{ text: query }],
            },
        ];
        const functionDeclarations = this.tools.map(
            toGeminiFunctionDeclaration
        );
        const finalText: string[] = [];

        while (true) {
            const response = await this.gemini.models.generateContent({
                model: this.model,
                contents,
                config: {
                    systemInstruction,
                    ...(functionDeclarations.length > 0
                        ? { tools: [{ functionDeclarations }] }
                        : {}),
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

            const functionResponses: Part[] = [];
            for (const functionCall of functionCalls) {
                if (!functionCall.name) {
                    throw new Error("Gemini returned a function call without a name");
                }

                const toolArgs = functionCall.args ?? {};
                const result = await this.mcp.callTool({
                    name: functionCall.name,
                    arguments: toolArgs,
                });

                finalText.push(
                    `[Calling tool ${functionCall.name} with args ${JSON.stringify(toolArgs)}]`
                );
                functionResponses.push({
                    functionResponse: {
                        id: functionCall.id,
                        name: functionCall.name,
                        response: {
                            content: result.content,
                            ...(result.structuredContent !== undefined
                                ? { structuredContent: result.structuredContent }
                                : {}),
                            ...(result.isError ? { isError: true } : {}),
                        },
                    },
                });
            }

            contents.push({ role: "user", parts: functionResponses });
        }
    }

    async chatLoop(): Promise<void> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        try {
            while (true) {
                const message = await rl.question("\nQuery: ");
                if (message.trim().toLowerCase() === "quit") {
                    return;
                }

                console.log(await this.processQuery(message));
            }
        } finally {
            rl.close();
        }
    }

    async cleanup(): Promise<void> {
        if (this.transport) {
            await this.mcp.close();
            this.transport = null;
        }
    }
}


async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node index.ts <path_to_server_script>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2], 'remote');
        await mcpClient.chatLoop();
    } catch (e) {
        console.error("Error:", e);
        await mcpClient.cleanup();
        process.exit(1);
    } finally {
        await mcpClient.cleanup();
        process.exit(0);
    }
}

main();
