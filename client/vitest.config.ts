import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.vitest.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
});
