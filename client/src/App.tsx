import { useMemo, useRef, useState } from "react";
import {
  availableTools,
  initialMessages,
  recentConversations,
  serverInfo,
} from "./data";
import type { Conversation, Message, ServerInfo, ServerTool } from "./types";

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
          conversation.title.toLowerCase().includes(normalizedQuery),
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
    <main className="flex min-h-screen bg-[var(--color-espresso)] text-[var(--color-cream)]">
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

// Temporary, typed shells: Tasks 3-5 replace these with focused components.
type SidebarProps = {
  conversations: Conversation[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
};

function Sidebar({ conversations, searchQuery, onSearchChange, onNewChat, onSelectConversation }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-[var(--color-border)] p-4">
      <button type="button" onClick={onNewChat}>New chat</button>
      <input
        aria-label="Search conversations"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <nav aria-label="Recent conversations">
        {conversations.map((conversation) => (
          <button key={conversation.id} type="button" onClick={() => onSelectConversation(conversation.id)}>
            {conversation.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}

type ChatHeaderProps = {
  isConnected: boolean;
  onToggleConnection: () => void;
  onToggleInspector: () => void;
  showInspector: boolean;
};

function ChatHeader({ isConnected, onToggleConnection, onToggleInspector, showInspector }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
      <div>
        <button type="button" onClick={onToggleConnection}>Toggle connection</button>
        <button type="button" onClick={onToggleInspector}>{showInspector ? "Hide inspector" : "Show inspector"}</button>
      </div>
    </header>
  );
}

function ConversationView({ messages, isResponding }: Pick<AppConversationProps, "messages" | "isResponding">) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4" aria-label="Conversation">
      {messages.map((message) => <p key={message.id}>{message.content}</p>)}
      {isResponding && <p>Searching feedback…</p>}
    </section>
  );
}

type AppConversationProps = { messages: Message[]; isResponding: boolean };

type ComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  isResponding: boolean;
  isConnected: boolean;
};

function Composer({ draft, onDraftChange, onSubmit, isResponding, isConnected }: ComposerProps) {
  return (
    <form className="border-t border-[var(--color-border)] p-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <textarea aria-label="Message" value={draft} onChange={(event) => onDraftChange(event.target.value)} />
      <button type="submit" disabled={!draft.trim() || isResponding || !isConnected}>Send</button>
    </form>
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
