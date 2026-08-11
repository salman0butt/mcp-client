import { parseSseStream } from "./sse";
import type { ApiStatus, ConnectRequest, StreamHandlers } from "./types";

async function readError(response: Response): Promise<Error> {
  const body = await response.text();

  try {
    const payload = JSON.parse(body) as { error?: unknown; message?: unknown };
    if (typeof payload.error === "string") {
      return new Error(payload.error);
    }
    if (typeof payload.message === "string") {
      return new Error(payload.message);
    }
  } catch {
    // Use the plain response text when the API did not return JSON.
  }

  return new Error(body || `Request failed with status ${response.status}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw await readError(response);
  }
  return response.json() as Promise<T>;
}

const jsonMutation = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export function getStatus(): Promise<ApiStatus> {
  return requestJson<ApiStatus>("/api/status");
}

export function connect(request: ConnectRequest): Promise<ApiStatus> {
  return requestJson<ApiStatus>("/api/connect", jsonMutation(request));
}

export function disconnect(): Promise<ApiStatus> {
  return requestJson<ApiStatus>("/api/disconnect", jsonMutation());
}

export async function streamChat(
  message: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/chat", {
    ...jsonMutation({ message }),
    signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }
  if (!response.body) {
    throw new Error("Chat response did not include a stream body");
  }

  await parseSseStream(response.body, (event) => {
    switch (event.type) {
      case "assistant-text":
        handlers.onAssistantText(event.text);
        break;
      case "tool-start":
        handlers.onToolStart(event);
        break;
      case "tool-result":
        handlers.onToolResult(event);
        break;
      case "complete":
        handlers.onComplete(event.text);
        break;
      case "error":
        handlers.onError(event.message);
        break;
    }
  });
}
