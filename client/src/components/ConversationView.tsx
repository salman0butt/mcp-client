import { useEffect, useRef } from "react";
import { MessageSquareText, Search, Sparkles, Wrench } from "lucide-react";
import type { Message } from "../types";
import { MessageBubble } from "./MessageBubble";

type ConversationViewProps = {
  messages: Message[];
  isResponding: boolean;
};

export function ConversationView({ messages, isResponding }: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <section
      aria-label="Conversation"
      aria-busy={isResponding}
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--color-espresso)] px-4 py-6 sm:px-6"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
        {!messages.length && !isResponding && <ConversationWelcome />}
        <div
          aria-atomic="false"
          aria-live="polite"
          aria-relevant="additions"
          className="flex flex-col gap-6"
          role="log"
        >
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isResponding && (
            <div className="flex items-center gap-3 text-sm text-[var(--color-taupe)]" role="status">
              <span
                aria-hidden="true"
                className="size-2 animate-pulse rounded-full bg-[var(--color-terracotta)]"
              />
              Searching feedback…
            </div>
          )}
        </div>
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </section>
  );
}

function ConversationWelcome() {
  const prompts = [
    { Icon: Search, text: "Search recent feedback" },
    { Icon: Wrench, text: "Explore available MCP tools" },
    { Icon: MessageSquareText, text: "Summarize a project thread" },
  ] as const;

  return (
    <div className="my-auto py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-charcoal)] text-[var(--color-terracotta)] shadow-lg shadow-black/10">
        <Sparkles aria-hidden="true" size={21} strokeWidth={2.2} />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-[var(--color-cream)]">
        Start a new MCP conversation
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-taupe)]">
        Ask the connected server to find context, inspect project data, or run one of its tools.
      </p>
      <ul className="mx-auto mt-6 grid max-w-2xl gap-2 text-left sm:grid-cols-3">
        {prompts.map(({ Icon, text }) => (
          <li
            key={text}
            className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-charcoal)] px-3 py-3 text-xs text-[var(--color-taupe)]"
          >
            <Icon aria-hidden="true" className="shrink-0 text-[var(--color-terracotta)]" size={15} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
