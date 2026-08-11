import readline from "readline/promises";

import { MCPClient } from "./mcpClient.js";


async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node index.ts <path_to_server_script>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2], 'remote');
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

main();
