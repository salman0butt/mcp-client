import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { connect, disconnect, getStatus } from "./api/client";
import { ConversationView } from "./components/ConversationView";
import type { Message } from "./types";

vi.mock("./api/client", () => ({
  getStatus: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
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

  test("closes the narrow drawer after loading a selected conversation", async () => {
    useMediaPreferences({ narrow: true });
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open navigation drawer" }));
    await user.click(screen.getByRole("button", { name: /Release notes review/ }));

    expect(screen.getByText(/August release includes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation drawer" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("conversation state", () => {
  test("loads local threads and clears the selection into a designed new-chat state", async () => {
    useMediaPreferences({ desktop: true });
    const user = userEvent.setup();

    render(<App />);

    const releaseNotes = screen.getByRole("button", { name: /Release notes review/ });
    await user.click(releaseNotes);

    expect(releaseNotes).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/August release includes/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.getByRole("heading", { name: "Start a new MCP conversation" })).toBeInTheDocument();
    expect(releaseNotes).not.toHaveAttribute("aria-current");
  });

  test("does not append a stale mock response after switching threads", async () => {
    useMediaPreferences({ desktop: true });
    vi.useFakeTimers();

    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Find launch feedback" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(screen.getByRole("button", { name: /Release notes review/ }));

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText(/August release includes/)).toBeInTheDocument();
    expect(screen.queryByText(/most relevant results for your request/)).not.toBeInTheDocument();
    expect(screen.queryByText("Searching feedback…")).not.toBeInTheDocument();
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

  test("keeps demo content available and reports an unavailable API", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockRejectedValue(new Error("Network failed"));

    render(<App />);

    expect(screen.getByText(/I found 18 recent feedback items/)).toBeInTheDocument();
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

  test("disconnects without removing the seeded conversation", async () => {
    useMediaPreferences({ desktop: true });
    vi.mocked(getStatus).mockResolvedValue(connectedStatus);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(screen.getAllByText("Disconnected")).toHaveLength(3));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(screen.getByText(/I found 18 recent feedback items/)).toBeInTheDocument();
  });
});
