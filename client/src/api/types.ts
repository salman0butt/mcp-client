export type ServerType = "local" | "remote";

export interface ServerTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ApiStatus {
  connected: boolean;
  serverType: ServerType | null;
  serverPath: string | null;
  serverName: string | null;
  transport: "stdio" | "streamable-http" | null;
  model: string;
  tools: ServerTool[];
}

export interface ConnectRequest {
  serverType: ServerType;
  serverPath: string;
}

export type ApiStreamEvent =
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
  | { type: "complete"; text: string }
  | { type: "error"; message: string };

export interface StreamHandlers {
  onAssistantText: (text: string) => void;
  onToolStart: (event: Extract<ApiStreamEvent, { type: "tool-start" }>) => void;
  onToolResult: (event: Extract<ApiStreamEvent, { type: "tool-result" }>) => void;
  onComplete: (text: string) => void;
  onError: (message: string) => void;
}
