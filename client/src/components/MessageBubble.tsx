import { Bot } from "lucide-react";
import type { Message } from "../types";
import { ToolCallCard } from "./ToolCallCard";

type MessageBubbleProps = {
  message: Message;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article className={isUser ? "ml-auto flex w-full max-w-xl flex-col items-end" : "flex w-full gap-3"}>
      {!isUser && (
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-terracotta)] text-[var(--color-espresso)]"
        >
          <Bot size={15} strokeWidth={2.5} />
        </span>
      )}
      <div className={isUser ? "w-full" : "min-w-0 flex-1"}>
        <div className={`mb-2 flex items-center gap-2 text-xs ${isUser ? "justify-end" : ""}`}>
          <span className="font-semibold text-[var(--color-cream)]">{isUser ? "You" : "Assistant"}</span>
          <time className="text-[var(--color-taupe)]">{message.timestamp}</time>
        </div>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-tr-md border border-[var(--color-border)] bg-[var(--color-charcoal)] px-4 py-3 text-sm leading-6 text-[var(--color-cream)]"
              : "text-sm leading-6 text-[var(--color-cream)]"
          }
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {message.toolCall && <ToolCallCard toolCall={message.toolCall} />}
      </div>
    </article>
  );
}
