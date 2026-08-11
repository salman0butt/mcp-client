import type { FormEvent, KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, Paperclip, SlidersHorizontal } from "lucide-react";

type ComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  isResponding: boolean;
  isConnected: boolean;
  model: string;
};

export function Composer({
  draft,
  onDraftChange,
  onSubmit,
  isResponding,
  isConnected,
  model,
}: ComposerProps) {
  const canSubmit = Boolean(draft.trim()) && !isResponding;

  const submit = () => {
    if (canSubmit) {
      onSubmit();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 bg-[var(--color-espresso)] px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
      <form
        className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-charcoal)] p-3 shadow-lg shadow-black/10"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="composer-message">
          Message
        </label>
        <textarea
          id="composer-message"
          className="block max-h-44 min-h-20 w-full resize-y bg-transparent px-1 py-1 text-sm leading-6 text-[var(--color-cream)] outline-none placeholder:text-[var(--color-taupe)]"
          placeholder="Message the MCP server…"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
          <div className="flex min-w-0 items-center gap-1 text-xs text-[var(--color-taupe)]">
            <button
              aria-label="Attach file"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
              type="button"
            >
              <Paperclip aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="Open composer actions"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
            </button>
            <span className="ml-1 flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className={`size-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-stone-500"}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[var(--color-taupe)] sm:inline">Model</span>
            <button
              aria-label={`Selected model: ${model}`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--color-taupe)] transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
              type="button"
            >
              {model}
              <ChevronDown aria-hidden="true" size={14} />
            </button>
            <button
              aria-label="Send message"
              className="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--color-terracotta)] text-[var(--color-espresso)] transition-colors hover:bg-[#e48968] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canSubmit}
              type="submit"
            >
              <ArrowUp aria-hidden="true" size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
