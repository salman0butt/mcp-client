import { useId, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import type { ToolCall } from "../types";

type ToolCallCardProps = {
  toolCall: ToolCall;
};

const statusPresentation = {
  success: { Icon: CheckCircle2, label: "Completed", className: "text-emerald-400" },
  running: { Icon: LoaderCircle, label: "Running", className: "animate-spin text-amber-300" },
  error: { Icon: CircleAlert, label: "Failed", className: "text-red-400" },
} as const;

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const detailsId = useId();
  const { Icon, label, className } = statusPresentation[toolCall.status];

  return (
    <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-charcoal)]">
      <button
        aria-controls={detailsId}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon aria-hidden="true" className={`mt-0.5 shrink-0 ${className}`} size={17} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <code className="break-all text-xs font-semibold text-[var(--color-cream)]">{toolCall.name}</code>
            <span className="text-xs text-[var(--color-taupe)]">{label}</span>
            <span className="text-xs text-[var(--color-taupe)]">{toolCall.duration}</span>
          </span>
          <span className="mt-1 block break-words text-sm text-[var(--color-taupe)]">{toolCall.summary}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-[var(--color-taupe)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          size={17}
        />
      </button>
      {isOpen && (
        <div id={detailsId} className="space-y-3 border-t border-[var(--color-border)] p-3">
          <ToolPayload label="Input" value={toolCall.input} />
          <ToolPayload label="Output" value={toolCall.output} />
        </div>
      )}
    </section>
  );
}

function ToolPayload({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-taupe)]">{label}</p>
      <pre className="max-w-full overflow-x-auto rounded-lg bg-[var(--color-espresso)] p-3 text-xs leading-5 text-[var(--color-cream)]">
        <code className="whitespace-pre-wrap break-words">{value}</code>
      </pre>
    </div>
  );
}
