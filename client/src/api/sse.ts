import type { ApiStreamEvent } from "./types";

export async function parseSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ApiStreamEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (block: string) => {
    let eventName = "message";
    const data: string[] = [];

    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) {
        continue;
      }

      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");

      if (field === "event") {
        eventName = value;
      } else if (field === "data") {
        data.push(value);
      }
    }

    if (!data.length) {
      return;
    }

    onEvent({ type: eventName, ...JSON.parse(data.join("\n")) } as ApiStreamEvent);
  };

  const flushCompleteBlocks = () => {
    const separator = /\r?\n\r?\n/;
    let match = separator.exec(buffer);

    while (match?.index !== undefined) {
      dispatch(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
      match = separator.exec(buffer);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      flushCompleteBlocks();
    }

    buffer += decoder.decode();
    flushCompleteBlocks();
    if (buffer) {
      dispatch(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}
