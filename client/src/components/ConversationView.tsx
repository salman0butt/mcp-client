import { useEffect, useRef } from "react";
import type { Message } from "../types";
import { MessageBubble } from "./MessageBubble";

type ConversationViewProps = {
  messages: Message[];
  isResponding: boolean;
};

export function ConversationView({ messages, isResponding }: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <section
      aria-label="Conversation"
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--color-espresso)] px-4 py-6 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </section>
  );
}
