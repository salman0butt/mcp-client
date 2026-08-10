import { useMemo, useRef, useState } from "react";
import { ChatHeader } from "./components/ChatHeader";
import { Composer } from "./components/Composer";
import { ConversationView } from "./components/ConversationView";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import {
  availableTools,
  initialConversationThreads,
  recentConversations,
  serverInfo,
} from "./data";
import { useMediaQuery } from "./hooks/useMediaQuery";
import type { Message } from "./types";

const createId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

const currentTime = () =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

export default function App() {
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    recentConversations[0]?.id ?? null,
  );
  const [conversationThreads, setConversationThreads] = useState(initialConversationThreads);
  const [newChatMessages, setNewChatMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInspector, setShowInspector] = useState(isDesktop);
  const [isInspectorMounted, setIsInspectorMounted] = useState(isDesktop);
  const [isConnected, setIsConnected] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const conversationGeneration = useRef(0);
  const messages = activeConversationId
    ? (conversationThreads[activeConversationId] ?? [])
    : newChatMessages;

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return normalizedQuery
      ? recentConversations.filter((conversation) =>
          `${conversation.title} ${conversation.preview}`
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : recentConversations;
  }, [searchQuery]);

  const updateMessages = (
    conversationId: string | null,
    update: (currentMessages: Message[]) => Message[],
  ) => {
    if (conversationId) {
      setConversationThreads((currentThreads) => ({
        ...currentThreads,
        [conversationId]: update(currentThreads[conversationId] ?? []),
      }));
      return;
    }

    setNewChatMessages(update);
  };

  const handleSend = () => {
    const content = draft.trim();

    if (!content || isResponding) {
      return;
    }

    const timestamp = currentTime();
    const requestGeneration = conversationGeneration.current;
    const requestConversationId = activeConversationId;

    updateMessages(requestConversationId, (currentMessages) => [
      ...currentMessages,
      {
        id: createId("message"),
        role: "user",
        content,
        timestamp,
      },
    ]);
    setDraft("");
    setIsResponding(true);

    window.setTimeout(() => {
      if (requestGeneration !== conversationGeneration.current) {
        return;
      }

      updateMessages(requestConversationId, (currentMessages) => [
        ...currentMessages,
        {
          id: createId("message"),
          role: "assistant",
          content:
            "I searched the latest product feedback and found the most relevant results for your request.",
          timestamp: currentTime(),
          toolCall: {
            id: createId("tool-call"),
            name: "search_feedback",
            summary: "Found 12 matching feedback items",
            status: "success",
            duration: "386ms",
            input: `{\n  "query": ${JSON.stringify(content)},\n  "limit": 12\n}`,
            output: '{\n  "count": 12,\n  "status": "success"\n}',
          },
        },
      ]);
      setIsResponding(false);
    }, 600);
  };

  const handleNewChat = () => {
    conversationGeneration.current += 1;
    setActiveConversationId(null);
    setNewChatMessages([]);
    setDraft("");
    setIsResponding(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    conversationGeneration.current += 1;
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
          onToggleConnection={() => setIsConnected((connected) => !connected)}
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
        />
      </section>
      {isInspectorMounted && (
        <Inspector
          isClosing={!showInspector}
          isConnected={isConnected}
          serverInfo={serverInfo}
          availableTools={availableTools}
          onRequestClose={() => setShowInspector(false)}
          onExited={() => setIsInspectorMounted(false)}
        />
      )}
    </main>
  );
}
