import readline from "readline/promises";
import { pathToFileURL } from "node:url";

import { MCPClient } from "./mcpClient.js";

export function inferServerType(serverPath: string): "local" | "remote" {
    if (/^[a-zA-Z]:[\\/]/.test(serverPath)) {
        return "local";
    }
    try {
        new URL(serverPath);
        return "remote";
    } catch {
        return "local";
    }
}

async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node index.ts <path_to_server_script>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2], inferServerType(process.argv[2]));
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
                console.log(await mcpClient.processQuery(message));
            }
        } finally {
            rl.close();
        }
    } catch (e) {
        console.error("Error:", e);
        await mcpClient.cleanup();
        process.exit(1);
    } finally {
        await mcpClient.cleanup();
        process.exit(0);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    void main();
}
