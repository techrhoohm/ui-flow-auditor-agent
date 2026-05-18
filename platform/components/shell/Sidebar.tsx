"use client";

import type { AuditRunResult } from "@/lib/audit-runner";

type Props = {
  running: boolean;
  progress: { index: number; total: number };
  history: AuditRunResult[];
};

const formatTime = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (start: number, end: number) => {
  const s = Math.max(1, Math.round((end - start) / 1000));
  return `${s}s`;
};

export function Sidebar({ running, progress, history }: Props) {
  const pct =
    progress.total > 0 ? Math.round((progress.index / progress.total) * 100) : 0;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/50">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          Run
        </div>
        {running ? (
          <>
            <div className="mt-1.5 flex items-center justify-between text-[12px] text-zinc-200">
              <span>auditing…</span>
              <span className="font-mono text-zinc-400">
                {progress.index}/{progress.total}
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-violet-400/70 transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <div className="mt-1.5 text-[12px] text-zinc-500">idle</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          History
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
            No completed runs yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {history.map((r) => {
              const high = r.findings.filter((f) => f.severity === "high").length;
              return (
                <li
                  key={r.id}
                  className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-zinc-200">{r.target}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {formatTime(r.startedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span>{r.findings.length} findings</span>
                    {high > 0 && (
                      <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-1.5 text-[10px] text-rose-300">
                        {high} high
                      </span>
                    )}
                    <span className="ml-auto font-mono">
                      {formatDuration(r.startedAt, r.endedAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          Avatar
        </div>
        <div className="mt-1 text-[12px] text-zinc-300">Nora</div>
        <div className="text-[11px] text-zinc-500">silent · detail-bound</div>
      </div>
    </aside>
  );
}
