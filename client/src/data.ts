import type { ApiStatus, ServerInfo, ServerTool } from "./types";

export const disconnectedServerInfo: ServerInfo = {
  name: "Not connected",
  path: "—",
  transport: "—",
  version: "—",
};

export function serverToolsFromApiStatus(apiStatus: ApiStatus): ServerTool[] {
  return apiStatus.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "No description provided.",
    category: "Live",
  }));
}

export function serverInfoFromApiStatus(apiStatus: ApiStatus): ServerInfo {
  return {
    name: apiStatus.serverName ?? "MCP server",
    path: apiStatus.serverPath ?? "Not connected",
    transport: apiStatus.transport ?? "Not connected",
    version: apiStatus.model,
  };
}
