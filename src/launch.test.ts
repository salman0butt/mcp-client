import { readFile } from "node:fs/promises";

import { expect, test } from "bun:test";

const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

test("runtime launch scripts load the repository environment", () => {
    expect(packageJson.scripts).toMatchObject({
        "start:api": "bun --dns-result-order=ipv4first dist/src/api.js",
        "start:server": "bun --dns-result-order=ipv4first dist/src/index.js",
        "start:cli": "bun --dns-result-order=ipv4first dist/src/index.js",
    });
});
