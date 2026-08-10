import { useState } from "react";
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

type SidebarProps = {
  conversations: Conversation[];
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
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectConversation,
}: SidebarProps) {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    conversations[0]?.id,
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 flex w-[17rem] flex-col border-r border-[var(--color-border)] bg-[var(--color-charcoal)] p-3 shadow-2xl shadow-black/20 transition-transform sm:static sm:translate-x-0 sm:shadow-none ${
        isDrawerOpen ? "translate-x-0" : "-translate-x-[calc(100%-3.5rem)]"
      }`}
    >
      <button
        aria-label={isDrawerOpen ? "Close navigation drawer" : "Open navigation drawer"}
        className="absolute right-0 top-3 flex size-11 items-center justify-center rounded-l-lg bg-[var(--color-charcoal)] text-[var(--color-taupe)] shadow-lg shadow-black/20 transition-colors hover:text-[var(--color-cream)] sm:hidden"
        type="button"
        onClick={() => setIsDrawerOpen((open) => !open)}
      >
        {isDrawerOpen ? <PanelLeftClose aria-hidden="true" size={18} /> : <PanelLeftOpen aria-hidden="true" size={18} />}
      </button>

      <div className="flex items-center gap-2 px-2 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-terracotta)] text-[var(--color-espresso)]">
          <Sparkles aria-hidden="true" size={16} strokeWidth={2.5} />
        </span>
        <span className="text-sm font-semibold tracking-wide text-[var(--color-cream)]">
          Claude Code
        </span>
      </div>

      <button
        className="mt-3 flex w-full items-center gap-2 rounded-lg bg-[var(--color-terracotta)] px-3 py-2.5 text-sm font-medium text-[var(--color-espresso)] transition-colors hover:bg-[#e48968]"
        type="button"
        onClick={onNewChat}
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

      <nav className="mt-6 min-h-0 flex-1 overflow-y-auto" aria-label="Recent conversations">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-taupe)]">
          Recent
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
                      setActiveConversationId(conversation.id);
                      onSelectConversation(conversation.id);
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
          <p className="px-2 py-4 text-sm text-[var(--color-taupe)]">No conversations found.</p>
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
  );
}
