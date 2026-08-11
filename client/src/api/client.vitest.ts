import { afterEach, describe, expect, it, vi } from "vitest";

import { getStatus } from "./client";
import { parseSseStream } from "./sse";
import type { ApiStreamEvent } from "./types";

const encoder = new TextEncoder();

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSseStream", () => {
  it("parses chunk-split events, multiline data, keep-alives, and a final error event", async () => {
    const events: ApiStreamEvent[] = [];

    await parseSseStream(
      streamFromChunks([
        "event: assistant-text\ndata: {\"text\":\n",
        "data: \"hello\"}\n\n\n",
        "event: err",
        "or\ndata: {\"message\":\"Chat stream failed\"}",
      ]),
      (event) => events.push(event),
    );

    expect(events).toEqual([
      { type: "assistant-text", text: "hello" },
      { type: "error", message: "Chat stream failed" },
    ]);
  });

  it("keeps the SSE framing type when a payload includes a type field", async () => {
    const events: ApiStreamEvent[] = [];

    await parseSseStream(
      streamFromChunks(["event: assistant-text\ndata: {\"type\":\"error\",\"text\":\"hello\"}\n\n"]),
      (event) => events.push(event),
    );

    expect(events).toEqual([{ type: "assistant-text", text: "hello" }]);
  });

  it("rejects a non-object SSE payload", async () => {
    await expect(
      parseSseStream(
        streamFromChunks(["event: assistant-text\ndata: \"hello\"\n\n"]),
        () => {},
      ),
    ).rejects.toThrow("SSE payload must be a JSON object");
  });
});

describe("getStatus", () => {
  it("turns a JSON API error response into a readable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "MCP server is not connected" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(getStatus()).rejects.toThrow("MCP server is not connected");
  });
});
