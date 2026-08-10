import type { Conversation, Message, ServerInfo, ServerTool } from "./types";

export const initialMessages: Message[] = [
  {
    id: "message-feedback-request",
    role: "user",
    content: "Find the most recent product feedback about onboarding friction and summarize the themes.",
    timestamp: "10:42 AM",
  },
  {
    id: "message-feedback-response",
    role: "assistant",
    content:
      "I found 18 recent feedback items. The strongest theme is confusion around workspace setup, followed by unclear invitation status and a desire for a guided first-project checklist.",
    timestamp: "10:42 AM",
    toolCall: {
      id: "tool-feedback-search",
      name: "search_feedback",
      summary: "Found 18 recent onboarding feedback items",
      status: "success",
      duration: "482ms",
      input: '{\n  "query": "onboarding friction",\n  "limit": 20\n}',
      output:
        '{\n  "count": 18,\n  "themes": ["workspace setup", "invite status", "first-project guidance"]\n}',
    },
  },
];

export const recentConversations: Conversation[] = [
  {
    id: "conversation-onboarding-feedback",
    title: "Recent onboarding feedback",
    preview: "Summarize setup friction from customer feedback",
    time: "10m",
    tone: "orange",
  },
  {
    id: "conversation-release-notes",
    title: "Release notes review",
    preview: "Collect linked issues for the August release",
    time: "1h",
    tone: "blue",
  },
  {
    id: "conversation-billing-themes",
    title: "Billing support themes",
    preview: "Look for recurring invoice questions",
    time: "Yesterday",
    tone: "green",
  },
  {
    id: "conversation-project-health",
    title: "Project health check",
    preview: "List active projects with overdue work",
    time: "Mon",
    tone: "blue",
  },
  {
    id: "conversation-research-summary",
    title: "Research thread summary",
    preview: "Condense notes from the discovery thread",
    time: "Aug 6",
    tone: "orange",
  },
];

export const availableTools: ServerTool[] = [
  {
    name: "search_feedback",
    description: "Search product feedback by keyword, date, or customer segment.",
    category: "Feedback",
  },
  {
    name: "list_projects",
    description: "List projects and their current delivery status.",
    category: "Projects",
  },
  {
    name: "get_issue",
    description: "Retrieve a single issue with its comments and metadata.",
    category: "Issues",
  },
  {
    name: "create_note",
    description: "Create a linked note for a project, issue, or conversation.",
    category: "Notes",
  },
  {
    name: "summarize_thread",
    description: "Summarize a discussion thread into decisions and follow-ups.",
    category: "Threads",
  },
];

export const serverInfo: ServerInfo = {
  name: "Product Operations MCP",
  path: "mcp://product-operations",
  transport: "stdio",
  version: "0.4.2",
};
