import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { connect, disconnect, getStatus, streamChat } from "./api/client";
import type { StreamHandlers } from "./api/types";
import { ConversationView } from "./components/ConversationView";
import type { Message } from "./types";

vi.mock("./api/client", () => ({
  getStatus: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  streamChat: vi.fn(),
}));

const disconnectedStatus = {
  connected: false,
  serverType: null,
  serverPath: null,
  serverName: null,
  transport: null,
  model: "gemini-2.5-flash",
  tools: [],
};

const connectedStatus = {
  connected: true,
  serverType: "remote" as const,
  serverPath: "https://mcp.example.com",
  serverName: "Example MCP",
  transport: "streamable-http" as const,
  model: "gemini-2.5-flash",
  tools: [
    {
      name: "lookup_customer",
      description: "Look up a customer by account ID.",
      inputSchema: { type: "object" },
    },
  ],
};

type MediaPreferences = {
  desktop?: boolean;
  narrow?: boolean;
  reducedMotion?: boolean;
};

function useMediaPreferences({
  desktop = false,
  narrow = false,
  reducedMotion = false,
}: MediaPreferences = {}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches:
        (query === "(min-width: 1280px)" && desktop) ||
        (query === "(max-width: 639px)" && narrow) ||
        (query === "(prefers-reduced-motion: reduce)" && reducedMotion),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function finishInspectorExit(inspector: HTMLElement) {
  fireEvent.animationEnd(inspector, { animationName: "inspector-exit" });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.mocked(getStatus).mockResolvedValue(disconnectedStatus);
  vi.mocked(connect).mockResolvedValue(connectedStatus);
  vi.mocked(disconnect).mockResolvedValue(disconnectedStatus);
  vi.mocked(streamChat).mockResolvedValue(undefined);
});

describe("responsive workspace", () => {
  test("keeps the inspector closed initially on a narrow viewport", () => {
    useMediaPreferences({ narrow: true });

    render(<App />);

    expect(screen.queryByLabelText("MCP inspector")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show inspector" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("conceals drawer controls and restores focus when keyboard-closing it", async () => {
    useMediaPreferences({ narrow: true });
    const user = userEvent.setup();

    render(<App />);

    const toggle = screen.getByRole("button", { name: "Open navigation drawer" });
    const drawer = document.getElementById("mcp-navigation");

    expect(toggle).toHaveAttribute("aria-controls", "mcp-navigation");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(drawer).not.toHaveAttribute("aria-hidden");
    await waitFor(() => expect(screen.getByRole("button", { name: "New chat" })).toHaveFocus());

    await user.keyboard("{Escape}");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(drawer).toHaveAttribute("inert");
    expect(toggle).toHaveFocus();
  });

  test("closes the narrow drawer after starting a new conversation", async () => {
    useMediaPreferences({ narrow: true });
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open navigation drawer" }));
    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.getByRole("button", { name: "Open navigation drawer" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("conversation state", () => {
  test("creates a conversation from a live response and clears the selection for a new chat", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);
    vi.mocked(streamChat).mockImplementation((_message, handlers) => {
      handlers.onComplete("Live MCP response");
      return Promise.resolve();
    });
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Message"), "What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect((await screen.findAllByText("Live MCP response")).length).toBeGreaterThan(0);
    const liveConversation = screen.getByRole("button", { name: /What is 2 \+ 2\?/ });
    expect(liveConversation).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.getByRole("heading", { name: "Start a new MCP conversation" })).toBeInTheDocument();
    expect(liveConversation).not.toHaveAttribute("aria-current");
  });

  test("does not apply stale stream events after switching threads", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);
    let handlers: StreamHandlers | undefined;
    vi.mocked(streamChat).mockImplementation((_message, streamHandlers) => {
      handlers = streamHandlers;
      return new Promise(() => undefined);
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Find launch feedback" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "New chat" }));

    act(() => {
      handlers?.onAssistantText("This response arrived too late.");
    });

    expect(screen.getByRole("heading", { name: "Start a new MCP conversation" })).toBeInTheDocument();
    expect(screen.queryByText("This response arrived too late.")).not.toBeInTheDocument();
    expect(screen.queryByText("Waiting for the MCP response…")).not.toBeInTheDocument();
  });

  test("streams assistant text and preserves completed and failed tool cards", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);
    const user = userEvent.setup();
    let handlers: StreamHandlers | undefined;
    vi.mocked(streamChat).mockImplementation((_message, streamHandlers) => {
      handlers = streamHandlers;
      return new Promise(() => undefined);
    });

    render(<App />);

    await user.type(screen.getByLabelText("Message"), "Find launch feedback");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await act(async () => {
      handlers?.onAssistantText("I found ");
    });
    expect(screen.getByRole("log")).toHaveTextContent("I found");

    await act(async () => {
      handlers?.onToolStart({
        type: "tool-start",
        id: "tool-1",
        name: "search_feedback",
        args: { query: "launch", limit: 12 },
      });
    });
    expect(screen.getByText("Running")).toBeInTheDocument();

    await act(async () => {
      handlers?.onToolStart({
        type: "tool-start",
        id: "tool-2",
        name: "lookup_customer",
        args: { accountId: "customer-42" },
      });
      handlers?.onToolResult({
        type: "tool-result",
        id: "tool-1",
        name: "search_feedback",
        content: [{ id: "feedback-1", title: "Launch notes" }],
        isError: false,
        durationMs: 386,
      });
      handlers?.onToolResult({
        type: "tool-result",
        id: "tool-2",
        name: "lookup_customer",
        content: { message: "Customer record is unavailable." },
        isError: true,
        durationMs: 91,
      });
      handlers?.onAssistantText("matching items.");
    });
    expect(screen.getAllByText("I found matching items.", { exact: true }).length).toBeGreaterThan(0);
    const completedToolCard = screen.getByText("386ms").closest("section");
    const failedToolCard = screen.getByText("91ms").closest("section");
    expect(completedToolCard).not.toBeNull();
    expect(failedToolCard).not.toBeNull();
    expect(within(completedToolCard as HTMLElement).getByText("Completed")).toBeInTheDocument();
    expect(within(failedToolCard as HTMLElement).getByText("Failed")).toBeInTheDocument();

    await user.click(within(completedToolCard as HTMLElement).getByRole("button", { name: /search_feedback/ }));
    expect(within(completedToolCard as HTMLElement).getByText(/"query": "launch"/)).toBeInTheDocument();
    expect(within(completedToolCard as HTMLElement).getByText(/"title": "Launch notes"/)).toBeInTheDocument();

    await user.click(within(failedToolCard as HTMLElement).getByRole("button", { name: /lookup_customer/ }));
    expect(within(failedToolCard as HTMLElement).getByText(/"accountId": "customer-42"/)).toBeInTheDocument();
    expect(within(failedToolCard as HTMLElement).getByText(/"Customer record is unavailable."/)).toBeInTheDocument();

    await act(async () => {
      handlers?.onComplete("I found matching items.");
    });
    expect(screen.queryByText("Waiting for the MCP response…")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Message"), "Ask another question");
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  test("renders stream errors and connection losses without leaving a response pending", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);
    const user = userEvent.setup();
    let handlers: StreamHandlers | undefined;
    vi.mocked(streamChat).mockImplementationOnce((_message, streamHandlers) => {
      handlers = streamHandlers;
      return new Promise(() => undefined);
    });

    render(<App />);

    await user.type(screen.getByLabelText("Message"), "Find launch feedback");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await act(async () => {
      handlers?.onError("The MCP server could not complete the request.");
    });

    expect(screen.getAllByText("The MCP server could not complete the request.", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Waiting for the MCP response…")).not.toBeInTheDocument();

    vi.mocked(streamChat).mockRejectedValueOnce(new Error("Connection lost while streaming."));
    await user.clear(screen.getByLabelText("Message"));
    await user.type(screen.getByLabelText("Message"), "Try again");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect((await screen.findAllByText("Connection lost while streaming.", { exact: true })).length).toBeGreaterThan(0);
    expect(screen.queryByText("Waiting for the MCP response…")).not.toBeInTheDocument();
  });

  test("starts with an empty live conversation and requires a connection", async () => {
    useMediaPreferences({ desktop: true });
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("Message"), "Find launch feedback");

    expect(screen.getByText("Connect to an MCP server to send a message.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start a new MCP conversation" })).toBeInTheDocument();
    expect(screen.queryByText(/I found 18 recent feedback items/)).not.toBeInTheDocument();
    expect(streamChat).not.toHaveBeenCalled();
  });
});

describe("announcements and motion", () => {
  const assistantMessage: Message = {
    id: "assistant-message",
    role: "assistant",
    content: "A newly completed MCP response.",
    timestamp: "11:00 AM",
  };

  test("uses a polite additions-only log for conversation updates", () => {
    useMediaPreferences();

    render(<ConversationView messages={[assistantMessage]} isResponding={false} />);

    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("log")).toHaveAttribute("aria-relevant", "additions");
    expect(screen.getByRole("log")).toHaveAttribute("aria-atomic", "false");
  });

  test("scrolls automatically when reduced motion is requested", () => {
    useMediaPreferences({ reducedMotion: true });

    render(<ConversationView messages={[assistantMessage]} isResponding={false} />);

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "end",
    });
  });
});

describe("inspector lifecycle", () => {
  test("routes the desktop header close through the inspector exit transition", async () => {
    useMediaPreferences({ desktop: true });
    const user = userEvent.setup();

    render(<App />);

    const inspector = screen.getByLabelText("MCP inspector");
    await user.click(screen.getByRole("button", { name: "Hide inspector" }));

    expect(inspector).toBeInTheDocument();
    expect(inspector).toHaveAttribute("aria-busy", "true");

    finishInspectorExit(inspector);

    await waitFor(() =>
      expect(screen.queryByLabelText("MCP inspector")).not.toBeInTheDocument(),
    );
  });
});

describe("live MCP connection", () => {
  test("hydrates the inspector with API server metadata and tools on mount", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Example MCP")).toBeInTheDocument());
    expect(screen.getByText("https://mcp.example.com")).toBeInTheDocument();
    expect(screen.getByText("lookup_customer")).toBeInTheDocument();
    expect(screen.getByText("Look up a customer by account ID.")).toBeInTheDocument();
  });

  test("reports an unavailable API without inventing conversation content", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockRejectedValue(new Error("Network failed"));

    render(<App />);

    expect(screen.getByRole("heading", { name: "Start a new MCP conversation" })).toBeInTheDocument();
    expect(
      await screen.findByText("API unavailable — start the API server to connect."),
    ).toBeInTheDocument();
  });

  test("submits a remote server draft and renders the connected server", async () => {
    useMediaPreferences({ desktop: true });
    const user = userEvent.setup();

    render(<App />);

    await user.selectOptions(screen.getByLabelText("Transport"), "remote");
    await user.clear(screen.getByLabelText("Server path"));
    await user.type(screen.getByLabelText("Server path"), "https://mcp.example.com");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(screen.getByText("Example MCP")).toBeInTheDocument());
    expect(connect).toHaveBeenCalledWith({
      serverType: "remote",
      serverPath: "https://mcp.example.com",
    });
  });

  test("keeps a completed connection when the initial status request resolves late", async () => {
    useMediaPreferences({ desktop: true });
    const user = userEvent.setup();
    let resolveInitialStatus: (status: typeof disconnectedStatus) => void = () => undefined;
    const initialStatus = new Promise<typeof disconnectedStatus>((resolve) => {
      resolveInitialStatus = resolve;
    });
    vi.mocked(getStatus).mockReturnValue(initialStatus);

    render(<App />);

    await user.selectOptions(screen.getByLabelText("Transport"), "remote");
    await user.type(screen.getByLabelText("Server path"), "https://mcp.example.com");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(screen.getByText("Example MCP")).toBeInTheDocument());

    await act(async () => {
      resolveInitialStatus(disconnectedStatus);
    });

    expect(screen.getByText("Example MCP")).toBeInTheDocument();
    expect(screen.getByText("https://mcp.example.com")).toBeInTheDocument();
  });

  test("disconnects without inventing a conversation", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(screen.getAllByText("Disconnected", { exact: true }).length).toBeGreaterThan(0));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Start a new MCP conversation" })).toBeInTheDocument();
  });
});
