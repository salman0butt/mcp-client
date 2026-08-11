import { useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquarePlus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import type { Conversation } from "../types";
import { useMediaQuery } from "../hooks/useMediaQuery";

type SidebarProps = {
  conversations: Conversation[];
  activeConversationId: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
};

const toneClasses: Record<Conversation["tone"], string> = {
  orange: "bg-[var(--color-terracotta)]",
  blue: "bg-sky-400",
  green: "bg-emerald-400",
};

export function Sidebar({
  conversations,
  activeConversationId,
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectConversation,
}: SidebarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const newChatRef = useRef<HTMLButtonElement>(null);
  const isConcealed = isNarrow && !isDrawerOpen;

  const closeDrawer = () => {
    if (!isNarrow) {
      return;
    }

    setIsDrawerOpen(false);
    drawerToggleRef.current?.focus();
  };

  useEffect(() => {
    if (isNarrow && isDrawerOpen) {
      newChatRef.current?.focus();
    }
  }, [isDrawerOpen, isNarrow]);

  useEffect(() => {
    if (!isNarrow || !isDrawerOpen) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isNarrow]);

  return (
    <>
      <button
        ref={drawerToggleRef}
        aria-label={isDrawerOpen ? "Close navigation drawer" : "Open navigation drawer"}
        aria-controls="mcp-navigation"
        aria-expanded={isDrawerOpen}
        className={`fixed left-3 top-3 z-30 flex size-11 items-center justify-center rounded-lg bg-[var(--color-charcoal)] text-[var(--color-taupe)] shadow-lg shadow-black/20 transition-transform hover:text-[var(--color-cream)] sm:hidden ${
          isDrawerOpen ? "translate-x-[13.5rem]" : "translate-x-0"
        }`}
        type="button"
        onClick={() => setIsDrawerOpen((open) => !open)}
      >
        {isDrawerOpen ? <PanelLeftClose aria-hidden="true" size={18} /> : <PanelLeftOpen aria-hidden="true" size={18} />}
      </button>

      <aside
        id="mcp-navigation"
        aria-hidden={isConcealed || undefined}
        inert={isConcealed || undefined}
        className={`fixed inset-y-0 left-0 z-20 flex w-[17rem] max-w-[calc(100vw-3.5rem)] flex-col border-r border-[var(--color-border)] bg-[var(--color-charcoal)] p-3 shadow-2xl shadow-black/20 transition-transform sm:static sm:max-w-none sm:translate-x-0 sm:shadow-none ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

      <div className="flex items-center gap-2 px-2 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-terracotta)] text-[var(--color-espresso)]">
          <Sparkles aria-hidden="true" size={16} strokeWidth={2.5} />
        </span>
        <span className="text-sm font-semibold tracking-wide text-[var(--color-cream)]">
          MCP Client
        </span>
      </div>

      <button
        ref={newChatRef}
        className="mt-3 flex w-full items-center gap-2 rounded-lg bg-[var(--color-terracotta)] px-3 py-2.5 text-sm font-medium text-[var(--color-espresso)] transition-colors hover:bg-[#e48968]"
        type="button"
        onClick={() => {
          onNewChat();
          closeDrawer();
        }}
      >
        <MessageSquarePlus aria-hidden="true" size={16} />
        New chat
      </button>

      <label className="relative mt-4 block">
        <span className="sr-only">Search conversations</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-taupe)]"
          size={15}
        />
        <input
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-espresso)] py-2 pl-9 pr-3 text-sm text-[var(--color-cream)] placeholder:text-[var(--color-taupe)]"
          placeholder="Search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <nav className="mt-6 min-h-0 flex-1 overflow-y-auto" aria-label="Conversations">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-taupe)]">
          Conversations
        </p>
        {conversations.length ? (
          <ul className="space-y-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <li key={conversation.id}>
                  <button
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5 ${
                      isActive
                        ? "bg-[var(--color-terracotta)] text-[var(--color-espresso)] hover:bg-[var(--color-terracotta)]"
                        : "text-[var(--color-cream)]"
                    }`}
                    type="button"
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      closeDrawer();
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${toneClasses[conversation.tone]}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                      <span
                        className={`block truncate pt-0.5 text-xs ${
                          isActive ? "text-[var(--color-espresso)]/75" : "text-[var(--color-taupe)]"
                        }`}
                      >
                        {conversation.preview}
                      </span>
                    </span>
                    <time
                      className={`shrink-0 pt-0.5 text-[11px] ${
                        isActive ? "text-[var(--color-espresso)]/75" : "text-[var(--color-taupe)]"
                      }`}
                    >
                      {conversation.time}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2 py-4 text-sm text-[var(--color-taupe)]">No conversations yet.</p>
        )}
      </nav>

      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
        <button
          aria-label="Open settings"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--color-taupe)] transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
          type="button"
        >
          <Settings aria-hidden="true" size={16} />
          Settings
        </button>
        <button
          aria-label="Open help"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--color-taupe)] transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
          type="button"
        >
          <CircleHelp aria-hidden="true" size={16} />
          Help &amp; feedback
        </button>
      </div>
      </aside>
    </>
  );
}
