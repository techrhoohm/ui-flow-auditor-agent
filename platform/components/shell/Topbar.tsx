"use client";

export type AuditTarget = "demo" | "vitalsapp";

type Props = {
  running: boolean;
  target: AuditTarget;
  onTargetChange: (t: AuditTarget) => void;
  onStart: () => void;
  onStop: () => void;
};

const TARGET_LABEL: Record<AuditTarget, string> = {
  demo: "Demo (scripted)",
  vitalsapp: "VitalsApp (live)",
};

export function Topbar({
  running,
  target,
  onTargetChange,
  onStart,
  onStop,
}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-400/40 bg-violet-500/10 font-mono text-[11px] text-violet-300">
          N
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-medium text-zinc-100">
            UI Flow Auditor
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            Milestone 4 · Live audit
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          {(["demo", "vitalsapp"] as const).map((t) => {
            const isActive = target === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTargetChange(t)}
                disabled={running}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-violet-500/15 text-violet-200"
                    : "text-zinc-400 hover:text-zinc-200"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={running ? "Stop the current run to switch targets" : ""}
              >
                {TARGET_LABEL[t]}
              </button>
            );
          })}
        </div>

        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[12px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
            </span>
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-zinc-200 transition-colors hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-200"
          >
            Start audit
          </button>
        )}
      </div>
    </header>
  );
}
