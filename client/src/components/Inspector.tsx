import { useEffect, type AnimationEvent, type FormEvent } from "react";
import { Server, WifiOff, Wrench, X } from "lucide-react";
import type { ApiStatus, ConnectionDraft, ConnectionError, ServerInfo, ServerTool } from "../types";

type InspectorProps = {
  isConnected: boolean;
  apiStatus: ApiStatus;
  connectionDraft: ConnectionDraft;
  isConnecting: boolean;
  connectionError: ConnectionError | null;
  isClosing: boolean;
  serverInfo: ServerInfo;
  availableTools: ServerTool[];
  onDraftChange: (draft: ConnectionDraft) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRequestClose: () => void;
  onExited: () => void;
};

export function Inspector({
  isConnected,
  apiStatus,
  connectionDraft,
  isConnecting,
  connectionError,
  isClosing,
  serverInfo,
  availableTools,
  onDraftChange,
  onConnect,
  onDisconnect,
  onRequestClose,
  onExited,
}: InspectorProps) {
  const connectionLabel = isConnected ? "Connected" : "Disconnected";
  const guidanceId = "connection-guidance";
  const errorId = "connection-error";

  const handleConnect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConnect();
  };

  useEffect(() => {
    if (!isClosing) {
      return;
    }

    const exitFallback = window.setTimeout(onExited, 220);
    return () => window.clearTimeout(exitFallback);
  }, [isClosing, onExited]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    if (isClosing && event.currentTarget === event.target) {
      onExited();
    }
  };

  return (
    <aside
      id="mcp-inspector"
      aria-label="MCP inspector"
      aria-busy={isClosing || undefined}
      className={`inspector-panel fixed inset-y-0 right-0 z-10 flex w-full max-w-80 shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-charcoal)] shadow-2xl shadow-black/30 xl:static xl:z-auto xl:w-80 xl:shadow-none ${
        isClosing ? "inspector-panel--closing pointer-events-none" : ""
      }`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-taupe)]">Inspector</p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--color-cream)]">MCP server</h2>
        </div>
        <button
          aria-label="Close inspector"
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-taupe)] transition-colors hover:bg-white/5 hover:text-[var(--color-cream)] xl:hidden"
          type="button"
          onClick={onRequestClose}
        >
          <X aria-hidden="true" size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <section aria-labelledby="connect-heading" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-espresso)] p-4">
          <h2 id="connect-heading" className="text-sm font-semibold text-[var(--color-cream)]">Connection</h2>
          <form className="mt-3 space-y-3" onSubmit={handleConnect}>
            <div>
              <label className="block text-xs font-medium text-[var(--color-cream)]" htmlFor="server-transport">Transport</label>
              <select
                id="server-transport"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-charcoal)] px-3 py-2 text-sm text-[var(--color-cream)] outline-none focus:border-[var(--color-terracotta)]"
                disabled={isConnecting}
                value={connectionDraft.serverType}
                onChange={(event) => onDraftChange({ ...connectionDraft, serverType: event.target.value as ConnectionDraft["serverType"] })}
              >
                <option value="local">Local</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-cream)]" htmlFor="server-path">Server path</label>
              <input
                id="server-path"
                aria-describedby={`${guidanceId}${connectionError ? ` ${errorId}` : ""}`}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-charcoal)] px-3 py-2 text-sm text-[var(--color-cream)] outline-none placeholder:text-[var(--color-taupe)] focus:border-[var(--color-terracotta)]"
                disabled={isConnecting}
                placeholder={connectionDraft.serverType === "local" ? "./server.js" : "https://example.com/mcp"}
                value={connectionDraft.serverPath}
                onChange={(event) => onDraftChange({ ...connectionDraft, serverPath: event.target.value })}
              />
              <p id={guidanceId} className="mt-1 text-xs leading-5 text-[var(--color-taupe)]">
                {connectionDraft.serverType === "local"
                  ? "Use a local .js or .py server path."
                  : "Use the remote server’s streamable HTTP URL."}
              </p>
              {connectionError && <p id={errorId} role="alert" className="mt-2 text-xs text-[var(--color-terracotta)]">{connectionError.message}</p>}
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-[var(--color-terracotta)] px-3 py-2 text-xs font-semibold text-[var(--color-espresso)] disabled:cursor-not-allowed disabled:opacity-45" disabled={isConnecting} type="submit">
                {isConnecting ? "Connecting…" : "Connect"}
              </button>
              <button className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-cream)] disabled:cursor-not-allowed disabled:opacity-45" disabled={!isConnected || isConnecting} type="button" onClick={onDisconnect}>
                Disconnect
              </button>
            </div>
          </form>
        </section>
        <section aria-labelledby="connection-heading" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-espresso)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--color-terracotta)]">
              {isConnected ? <Server aria-hidden="true" size={17} /> : <WifiOff aria-hidden="true" size={17} />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-[var(--color-terracotta)]"}`}
                />
                <p id="connection-heading" className="text-sm font-semibold text-[var(--color-cream)]">
                  {connectionLabel}
                </p>
              </div>
              <p className="mt-1 truncate text-sm text-[var(--color-taupe)]">{serverInfo.name}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
            <ConnectionDetail label="Path" value={serverInfo.path} mono />
            <ConnectionDetail label="Transport" value={serverInfo.transport} />
            <ConnectionDetail label="Version" value={serverInfo.version} />
            {apiStatus.serverType && <ConnectionDetail label="Type" value={apiStatus.serverType} />}
          </dl>
        </section>

        <section aria-labelledby="tools-heading">
          <div className="flex items-center justify-between">
            <h2 id="tools-heading" className="text-sm font-semibold text-[var(--color-cream)]">Available tools</h2>
            <span className="text-xs text-[var(--color-taupe)]">{availableTools.length}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {availableTools.map((tool) => (
              <li key={tool.name}>
                <ToolCatalogCard tool={tool} />
              </li>
            ))}
          </ul>
        </section>

      </div>
    </aside>
  );
}

function ConnectionDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[var(--color-taupe)]">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-[var(--color-cream)] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function ToolCatalogCard({ tool }: { tool: ServerTool }) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-espresso)] p-3 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-start gap-2">
        <Wrench aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-terracotta)]" size={15} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <code className="break-all text-xs font-semibold text-[var(--color-cream)]">{tool.name}</code>
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-taupe)]">
              {tool.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-taupe)]">{tool.description}</p>
        </div>
      </div>
    </article>
  );
}
