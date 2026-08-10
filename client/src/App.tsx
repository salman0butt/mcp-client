import { useMemo, useRef, useState } from "react";
import { ChatHeader } from "./components/ChatHeader";
import { Composer } from "./components/Composer";
import { ConversationView } from "./components/ConversationView";
import { Sidebar } from "./components/Sidebar";
import {
  availableTools,
  initialMessages,
  recentConversations,
  serverInfo,
} from "./data";
import type { Message, ServerInfo, ServerTool } from "./types";

const createId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

const currentTime = () =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

export default function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInspector, setShowInspector] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const conversationGeneration = useRef(0);

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

  const handleSend = () => {
    const content = draft.trim();

    if (!content || isResponding) {
      return;
    }

    const timestamp = currentTime();
    const requestGeneration = conversationGeneration.current;

    setMessages((currentMessages) => [
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

      setMessages((currentMessages) => [
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
    setMessages([]);
    setIsResponding(false);
  };

  return (
    <main className="flex h-screen min-h-screen bg-[var(--color-espresso)] text-[var(--color-cream)]">
      <Sidebar
        conversations={filteredConversations}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewChat={handleNewChat}
        onSelectConversation={() => undefined}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          isConnected={isConnected}
          onToggleConnection={() => setIsConnected((connected) => !connected)}
          onToggleInspector={() => setShowInspector((visible) => !visible)}
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
      {showInspector && (
        <Inspector
          isConnected={isConnected}
          serverInfo={serverInfo}
          availableTools={availableTools}
          onClose={() => setShowInspector(false)}
        />
      )}
    </main>
  );
}

type InspectorProps = {
  isConnected: boolean;
  serverInfo: ServerInfo;
  availableTools: ServerTool[];
  onClose: () => void;
};

function Inspector({ isConnected, serverInfo, availableTools, onClose }: InspectorProps) {
  return (
    <aside className="w-80 shrink-0 border-l border-[var(--color-border)] p-4">
      <button type="button" onClick={onClose}>Close inspector</button>
      <p>{isConnected ? "Connected" : "Disconnected"} to {serverInfo.name}</p>
      <ul>{availableTools.map((tool) => <li key={tool.name}>{tool.name}</li>)}</ul>
    </aside>
  );
}
