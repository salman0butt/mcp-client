import { useEffect, useMemo, useRef, useState } from "react";
import { connect, disconnect, getStatus, streamChat } from "./api/client";
import type { StreamHandlers } from "./api/types";
import { ChatHeader } from "./components/ChatHeader";
import { Composer } from "./components/Composer";
import { ConversationView } from "./components/ConversationView";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import {
  disconnectedServerInfo,
  serverInfoFromApiStatus,
  serverToolsFromApiStatus,
} from "./data";
import { useMediaQuery } from "./hooks/useMediaQuery";
import type {
  ApiStatus,
  ConnectionDraft,
  ConnectionError,
  Conversation,
  Message,
  ToolCall,
} from "./types";

const disconnectedStatus: ApiStatus = {
  connected: false,
  serverType: null,
  serverPath: null,
  serverName: null,
  transport: null,
  model: "Not available",
  tools: [],
};

const initialConnectionDraft: ConnectionDraft = {
  serverType: "local",
  serverPath: "",
};

const createId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

const currentTime = () =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

const serializePayload = (payload: unknown) => {
  try {
    const serialized = JSON.stringify(payload, null, 2);
    return serialized ?? String(payload);
  } catch {
    return String(payload);
  }
};

function summarizeConversations(threads: Record<string, Message[]>): Conversation[] {
  const tones: Conversation["tone"][] = ["orange", "blue", "green"];

  return Object.entries(threads)
    .reverse()
    .map(([id, messages], index) => {
      const firstUserMessage = messages.find((message) => message.role === "user");
      const latestMessage = messages[messages.length - 1];
      const title = firstUserMessage?.content.trim() || "New conversation";

      return {
        id,
        title: title.length > 42 ? `${title.slice(0, 42)}…` : title,
        preview: latestMessage?.content || "Waiting for a response…",
        time: latestMessage?.timestamp ?? "Now",
        tone: tones[index % tones.length],
      };
    });
}

export default function App() {
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationThreads, setConversationThreads] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInspector, setShowInspector] = useState(isDesktop);
  const [isInspectorMounted, setIsInspectorMounted] = useState(isDesktop);
  const [apiStatus, setApiStatus] = useState<ApiStatus>(disconnectedStatus);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(initialConnectionDraft);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<ConnectionError | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const conversationGeneration = useRef(0);
  const connectionRequestGeneration = useRef(0);
  const chatAbortController = useRef<AbortController | null>(null);
  const messages = activeConversationId ? (conversationThreads[activeConversationId] ?? []) : [];
  const isConnected = apiStatus.connected;
  const inspectorServerInfo = isConnected ? serverInfoFromApiStatus(apiStatus) : disconnectedServerInfo;
  const inspectorTools = isConnected ? serverToolsFromApiStatus(apiStatus) : [];

  useEffect(() => {
    let isCurrent = true;
    const hydrationGeneration = connectionRequestGeneration.current;

    getStatus()
      .then((status) => {
        if (!isCurrent || hydrationGeneration !== connectionRequestGeneration.current) return;
        setApiStatus(status);
        if (status.serverType && status.serverPath) {
          setConnectionDraft({ serverType: status.serverType, serverPath: status.serverPath });
        }
      })
      .catch(() => {
        if (isCurrent && hydrationGeneration === connectionRequestGeneration.current) {
          setConnectionError({ message: "API unavailable — start the API server to connect." });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => () => chatAbortController.current?.abort(), []);

  const handleConnect = async () => {
    if (!connectionDraft.serverPath.trim()) {
      setConnectionError({ message: "Enter a server path or URL to connect." });
      return;
    }

    connectionRequestGeneration.current += 1;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const status = await connect({
        serverType: connectionDraft.serverType,
        serverPath: connectionDraft.serverPath.trim(),
      });
      setApiStatus(status);
      setConnectionDraft({
        serverType: status.serverType ?? connectionDraft.serverType,
        serverPath: status.serverPath ?? connectionDraft.serverPath.trim(),
      });
    } catch (error) {
      setConnectionError({ message: error instanceof Error ? error.message : "Unable to connect to the MCP server." });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    connectionRequestGeneration.current += 1;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      setApiStatus(await disconnect());
    } catch (error) {
      setConnectionError({ message: error instanceof Error ? error.message : "Unable to disconnect from the MCP server." });
    } finally {
      setIsConnecting(false);
    }
  };

  const conversations = useMemo(() => summarizeConversations(conversationThreads), [conversationThreads]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return normalizedQuery
      ? conversations.filter((conversation) =>
          `${conversation.title} ${conversation.preview}`
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : conversations;
  }, [conversations, searchQuery]);

  const updateMessages = (
    conversationId: string,
    update: (currentMessages: Message[]) => Message[],
  ) => {
    setConversationThreads((currentThreads) => ({
      ...currentThreads,
      [conversationId]: update(currentThreads[conversationId] ?? []),
    }));
  };

  const handleSend = () => {
    const content = draft.trim();

    if (!content || isResponding || !isConnected) {
      return;
    }

    const timestamp = currentTime();
    const requestGeneration = conversationGeneration.current;
    const requestConversationId = activeConversationId ?? createId("conversation");
    const assistantMessageId = createId("message");
    const abortController = new AbortController();
    chatAbortController.current?.abort();
    chatAbortController.current = abortController;

    const isCurrentRequest = () =>
      requestGeneration === conversationGeneration.current &&
      chatAbortController.current === abortController;

    const updateAssistantMessage = (update: (message: Message) => Message) => {
      if (!isCurrentRequest()) return;

      updateMessages(requestConversationId, (currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId ? update(message) : message,
        ),
      );
    };

    const finishWithError = (message: string) => {
      updateAssistantMessage((assistantMessage) => ({
        ...assistantMessage,
        content: assistantMessage.content
          ? `${assistantMessage.content}\n\n${message}`
          : message,
      }));
      if (isCurrentRequest()) setIsResponding(false);
    };

    updateMessages(requestConversationId, (currentMessages) => [
      ...currentMessages,
      {
        id: createId("message"),
        role: "user",
        content,
        timestamp,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp,
      },
    ]);
    setActiveConversationId(requestConversationId);
    setDraft("");
    setIsResponding(true);

    const handlers: StreamHandlers = {
      onAssistantText: (text) => {
        updateAssistantMessage((assistantMessage) => ({
          ...assistantMessage,
          content: `${assistantMessage.content}${text}`,
        }));
      },
      onToolStart: (event) => {
        const toolCall: ToolCall = {
          id: event.id,
          name: event.name,
          summary: `Running ${event.name}`,
          status: "running",
          duration: "",
          input: serializePayload(event.args),
          output: "",
        };
        updateAssistantMessage((assistantMessage) => ({
          ...assistantMessage,
          toolCalls: [...(assistantMessage.toolCalls ?? []), toolCall],
        }));
      },
      onToolResult: (event) => {
        updateAssistantMessage((assistantMessage) => {
          const toolCall = assistantMessage.toolCalls?.find((call) => call.id === event.id);
          if (!toolCall) return assistantMessage;

          return {
            ...assistantMessage,
            toolCalls: assistantMessage.toolCalls?.map((call) =>
              call.id === event.id
                ? {
                    ...call,
                    summary: event.isError
                      ? `${event.name} returned an error`
                      : `${event.name} completed`,
                    status: event.isError ? "error" : "success",
                    duration: `${event.durationMs}ms`,
                    output: serializePayload(event.content),
                  }
                : call,
            ),
          };
        });
      },
      onComplete: (text) => {
        updateAssistantMessage((assistantMessage) => ({
          ...assistantMessage,
          content: text || assistantMessage.content,
        }));
        if (isCurrentRequest()) setIsResponding(false);
      },
      onError: finishWithError,
    };

    void streamChat(content, handlers, abortController.signal)
      .catch((error) => {
        if (!abortController.signal.aborted) {
          finishWithError(error instanceof Error ? error.message : "Unable to stream the MCP response.");
        }
      })
      .finally(() => {
        if (isCurrentRequest()) {
          setIsResponding(false);
          chatAbortController.current = null;
        }
      });
  };

  const handleNewChat = () => {
    conversationGeneration.current += 1;
    chatAbortController.current?.abort();
    chatAbortController.current = null;
    setActiveConversationId(null);
    setDraft("");
    setIsResponding(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    conversationGeneration.current += 1;
    chatAbortController.current?.abort();
    chatAbortController.current = null;
    setActiveConversationId(conversationId);
    setIsResponding(false);
  };

  const handleToggleInspector = () => {
    if (showInspector) {
      setShowInspector(false);
      return;
    }

    setIsInspectorMounted(true);
    setShowInspector(true);
  };

  return (
    <main className="flex h-screen min-h-screen overflow-hidden bg-[var(--color-espresso)] text-[var(--color-cream)]">
      <Sidebar
        conversations={filteredConversations}
        searchQuery={searchQuery}
        activeConversationId={activeConversationId}
        onSearchChange={setSearchQuery}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          isConnected={isConnected}
          model={apiStatus.model}
          isConnecting={isConnecting}
          onManageConnection={() => {
            setIsInspectorMounted(true);
            setShowInspector(true);
          }}
          onDisconnect={handleDisconnect}
          onToggleInspector={handleToggleInspector}
          showInspector={showInspector}
        />
        <ConversationView messages={messages} isResponding={isResponding} />
        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSend}
          isResponding={isResponding}
          isConnected={isConnected}
          model={apiStatus.model}
        />
      </section>
      {isInspectorMounted && (
        <Inspector
          isClosing={!showInspector}
          isConnected={isConnected}
          apiStatus={apiStatus}
          connectionDraft={connectionDraft}
          isConnecting={isConnecting}
          connectionError={connectionError}
          serverInfo={inspectorServerInfo}
          availableTools={inspectorTools}
          onDraftChange={setConnectionDraft}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onRequestClose={() => setShowInspector(false)}
          onExited={() => setIsInspectorMounted(false)}
        />
      )}
    </main>
  );
}
