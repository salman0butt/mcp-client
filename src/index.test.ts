import { expect, test } from "bun:test";

test("infers a local script argument and an absolute URL argument", async () => {
    const originalArgv = process.argv;
    process.argv = [process.execPath, "index.ts"];
    try {
        const module = await import(`./index.ts?inference=${Date.now()}`) as Record<string, unknown>;
        const inferServerType = module.inferServerType as ((serverPath: string) => string) | undefined;

        expect(inferServerType?.("/tmp/server.py")).toBe("local");
        expect(inferServerType?.("C:\\mcp\\server.py")).toBe("local");
        expect(inferServerType?.("D:\\tools\\server.js")).toBe("local");
        expect(inferServerType?.("https://mcp.example.test/stream")).toBe("remote");
    } finally {
        process.argv = originalArgv;
    }
});
