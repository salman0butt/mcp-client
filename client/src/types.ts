import type { ApiStatus as ApiClientStatus, ServerType as ApiServerType } from "./api/types";

export type MessageRole = "user" | "assistant";
export type ToolCallStatus = "running" | "success" | "error";

export interface ToolCall {
  id: string;
  name: string;
  summary: string;
  status: ToolCallStatus;
  duration: string;
  input: string;
  output: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  toolCall?: ToolCall;
  toolCalls?: ToolCall[];
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  time: string;
  tone: "orange" | "blue" | "green";
}

export interface ServerTool {
  name: string;
  description: string;
  category: string;
}

export interface ServerInfo {
  name: string;
  path: string;
  transport: string;
  version: string;
}

export type ServerType = ApiServerType;
export type ApiStatus = ApiClientStatus;

export interface ConnectionDraft {
  serverType: ServerType;
  serverPath: string;
}

export interface ConnectionError {
  message: string;
}
