import { PanelRightClose, PanelRightOpen, Plug, Unplug } from "lucide-react";

type ChatHeaderProps = {
  isConnected: boolean;
  onToggleConnection: () => void;
  onToggleInspector: () => void;
  showInspector: boolean;
};

export function ChatHeader({
  isConnected,
  onToggleConnection,
  onToggleInspector,
  showInspector,
}: ChatHeaderProps) {
  const connectionLabel = isConnected ? "Connected" : "Disconnected";

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-espresso)] px-4 sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-[var(--color-cream)]">MCP Client</h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-taupe)]">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-stone-500"}`}
          />
          <span>{connectionLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">gemini-2.5-flash</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label={isConnected ? "Disconnect MCP server" : "Connect MCP server"}
          className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-taupe)] transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
          type="button"
          onClick={onToggleConnection}
        >
          {isConnected ? <Unplug aria-hidden="true" size={15} /> : <Plug aria-hidden="true" size={15} />}
          <span className="hidden sm:inline">{isConnected ? "Disconnect" : "Connect"}</span>
        </button>
        <button
          aria-label={showInspector ? "Hide inspector" : "Show inspector"}
          aria-pressed={showInspector}
          className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-taupe)] transition-colors hover:bg-white/5 hover:text-[var(--color-cream)]"
          type="button"
          onClick={onToggleInspector}
        >
          {showInspector ? <PanelRightClose aria-hidden="true" size={16} /> : <PanelRightOpen aria-hidden="true" size={16} />}
          <span className="hidden sm:inline">Inspector</span>
        </button>
      </div>
    </header>
  );
}
