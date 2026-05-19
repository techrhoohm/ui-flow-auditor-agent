"use client";

import { useEffect, useState } from "react";
import type { AuditRunResult } from "@/lib/audit-runner";
import { summarize, type QARun } from "@/lib/qa-runs";
import { getBaselineMeta, BASELINES_EVENT, type BaselineMeta } from "@/lib/baselines";

type Props = {
  running: boolean;
  progress: { index: number; total: number };
  history: AuditRunResult[];
  qaRuns: QARun[];
  qaCaseCount: number;
  targetKey: string;
  hasScreenshots: boolean;
  onStartQA: () => void;
  onResumeQA: (id: string) => void;
  onSetBaseline: () => void;
  onClearBaseline: () => void;
};

const formatTime = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (start: number, end: number) => {
  const s = Math.max(1, Math.round((end - start) / 1000));
  return `${s}s`;
};

export function Sidebar({
  running,
  progress,
  history,
  qaRuns,
  qaCaseCount,
  targetKey,
  hasScreenshots,
  onStartQA,
  onResumeQA,
  onSetBaseline,
  onClearBaseline,
}: Props) {
  const pct =
    progress.total > 0 ? Math.round((progress.index / progress.total) * 100) : 0;

  const [baselineMeta, setBaselineMeta] = useState<BaselineMeta>({ count: 0, savedAt: null });
  useEffect(() => {
    const refresh = () => setBaselineMeta(getBaselineMeta(targetKey));
    refresh();
    window.addEventListener(BASELINES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(BASELINES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [targetKey]);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/50">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          Audit
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

      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Manual QA
          </div>
          <button
            type="button"
            onClick={onStartQA}
            disabled={qaCaseCount === 0}
            title={
              qaCaseCount === 0
                ? "Add test cases on any node first"
                : `Run ${qaCaseCount} test case${qaCaseCount === 1 ? "" : "s"}`
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:enabled:border-violet-400/40 hover:enabled:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start
          </button>
        </div>
        {qaRuns.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {qaCaseCount === 0
              ? "Author test cases first."
              : "No QA runs yet."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {qaRuns.slice(0, 4).map((r) => {
              const s = summarize(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onResumeQA(r.id)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-left transition-colors hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-zinc-500">
                        {formatTime(r.startedAt)}
                      </span>
                      {r.completedAt ? (
                        <span className="font-mono text-[9px] text-zinc-600">
                          done
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] text-violet-300">
                          in-progress
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <span className="text-emerald-300">{s.pass}p</span>
                      <span className="text-rose-300">{s.fail}f</span>
                      <span className="text-amber-200">{s.blocked}b</span>
                      <span className="ml-auto text-zinc-500">
                        {s.evaluated}/{s.total}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Visual baseline
          </div>
          <div className="flex items-center gap-1.5">
            {baselineMeta.count > 0 && (
              <button
                type="button"
                onClick={onClearBaseline}
                className="text-[9px] text-zinc-600 hover:text-rose-300"
                title="Clear baseline"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onSetBaseline}
              disabled={!hasScreenshots || running}
              title={!hasScreenshots ? "Run a URL audit first to capture screenshots" : "Save current screenshots as baseline"}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:enabled:border-violet-400/40 hover:enabled:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </div>
        {baselineMeta.count > 0 ? (
          <p className="mt-1.5 text-[11px] text-zinc-400">
            {baselineMeta.count} screen{baselineMeta.count === 1 ? "" : "s"} ·{" "}
            <span className="text-zinc-500">
              {baselineMeta.savedAt ? new Date(baselineMeta.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {hasScreenshots ? "No baseline set. Click Set to save current screenshots." : "Run a URL audit to capture screenshots first."}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          History
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
            No completed audits yet.
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
                    <span className="truncate text-[12px] text-zinc-200">
                      {r.target}
                    </span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-zinc-500">
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
