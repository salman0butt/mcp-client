import { Activity, CheckCircle2, Clock3, Server, WifiOff, Wrench, X } from "lucide-react";
import type { ServerInfo, ServerTool } from "../types";

type InspectorProps = {
  isConnected: boolean;
  serverInfo: ServerInfo;
  availableTools: ServerTool[];
  onClose: () => void;
};

const recentActivity = [
  { label: "Connected to server", time: "10:42 AM", Icon: CheckCircle2, className: "text-emerald-400" },
  { label: "Tool catalog synchronized", time: "10:41 AM", Icon: Activity, className: "text-[var(--color-terracotta)]" },
  { label: "stdio transport ready", time: "10:40 AM", Icon: Clock3, className: "text-[var(--color-taupe)]" },
] as const;

export function Inspector({ isConnected, serverInfo, availableTools, onClose }: InspectorProps) {
  const connectionLabel = isConnected ? "Connected" : "Disconnected";

  return (
    <aside
      aria-label="MCP inspector"
      className="inspector-panel fixed inset-y-0 right-0 z-10 flex w-full max-w-80 shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-charcoal)] shadow-2xl shadow-black/30 xl:static xl:z-auto xl:w-80 xl:shadow-none"
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
          onClick={onClose}
        >
          <X aria-hidden="true" size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
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

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-sm font-semibold text-[var(--color-cream)]">Recent activity</h2>
          <ul className="mt-3 space-y-3 border-l border-[var(--color-border)] pl-4">
            {recentActivity.map(({ label, time, Icon, className }) => (
              <li key={label} className="relative flex gap-2 text-xs">
                <Icon aria-hidden="true" className={`absolute -left-[1.57rem] top-0 size-4 bg-[var(--color-charcoal)] ${className}`} />
                <span className="min-w-0 flex-1 text-[var(--color-taupe)]">{label}</span>
                <time className="shrink-0 text-[var(--color-taupe)]">{time}</time>
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
