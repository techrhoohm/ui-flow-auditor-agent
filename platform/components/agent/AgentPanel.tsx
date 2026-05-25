"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { AgentConfig, AgentTarget } from "@/lib/agent-config";
import { DEFAULT_AGENT_CONFIG } from "@/lib/agent-config";
import type { AgentRun } from "@/lib/agent-store";

// --- helpers ---

const LS_CONFIG_KEY = "uifa:agent:config";
const LS_RUN_PREFIX = "uifa:agent:run:";

type TargetRunSummary = {
  runAt: number;
  state: string;
  issuesFound: number;
  maxSeverity: "low" | "medium" | "high" | null;
};

function lsSaveTargetRun(targetId: string, s: TargetRunSummary) {
  try { localStorage.setItem(LS_RUN_PREFIX + targetId, JSON.stringify(s)); } catch { /* quota */ }
}

function lsLoadTargetRun(targetId: string): TargetRunSummary | null {
  try {
    const raw = localStorage.getItem(LS_RUN_PREFIX + targetId);
    if (!raw) return null;
    return JSON.parse(raw) as TargetRunSummary;
  } catch { return null; }
}

function relativeTime(ts: number): string {
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

function maxSeverityFromRun(run: AgentRun): "low" | "medium" | "high" | null {
  const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const findings = run.crawlResult?.findings ?? [];
  return findings.reduce<"low" | "medium" | "high" | null>((max, f) => {
    const sev = f.severity as "low" | "medium" | "high";
    if (!max || rank[sev] > rank[max]) return sev;
    return max;
  }, null);
}

// --- hooks ---

function lsLoadConfig(): AgentConfig | null {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AgentConfig;
  } catch { return null; }
}

function lsSaveConfig(c: AgentConfig) {
  try { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(c)); } catch { /* quota */ }
}

function useAgentConfig() {
  const [config, setConfigState] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed from localStorage immediately so targets survive cold starts.
    const local = lsLoadConfig();
    if (local) setConfigState(local);

    fetch("/api/agent/config")
      .then((r) => r.json())
      .then((d) => {
        const server = d as AgentConfig;
        // Prefer server config only if it has targets; otherwise keep localStorage.
        const merged = server.targets.length > 0 ? server : (local ?? server);
        setConfigState(merged);
        lsSaveConfig(merged);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(async (next: AgentConfig) => {
    setConfigState(next);
    lsSaveConfig(next);
    await fetch("/api/agent/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {/* non-fatal — localStorage is the durable store */});
  }, []);

  return { config, save, loading };
}

type AgentStatus = { current: AgentRun | null; last: AgentRun | null; allLastRuns: AgentRun[] };

function useAgentStream() {
  const [status, setStatus] = useState<AgentStatus>({ current: null, last: null, allLastRuns: [] });
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(false);

  const fetchStatus = useCallback(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then((d) => {
        const s = d as Partial<AgentStatus>;
        setStatus({ current: s.current ?? null, last: s.last ?? null, allLastRuns: s.allLastRuns ?? [] });
      })
      .catch(() => {});
  }, []);

  // Poll when not streaming
  useEffect(() => {
    fetchStatus();
    const id = setInterval(() => { if (!streamingRef.current) fetchStatus(); }, 4000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const startStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    streamingRef.current = true;

    const es = new EventSource("/api/agent/stream");
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const run = JSON.parse(e.data as string) as AgentRun;
        setStatus((prev) => ({ ...prev, current: run }));
        if (run.state === "done" || run.state === "error") {
          es.close();
          esRef.current = null;
          streamingRef.current = false;
          fetchStatus();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      streamingRef.current = false;
      fetchStatus();
    };
  }, [fetchStatus]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  return { status, startStream };
}

// --- sub-components ---

const STATE_COLOR: Record<string, string> = {
  queued: "text-zinc-400",
  crawling: "text-sky-300",
  analyzing: "text-violet-300",
  reporting: "text-amber-300",
  done: "text-emerald-300",
  error: "text-rose-300",
};

function RunCard({ run, label }: { run: AgentRun; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const age = Math.round((Date.now() - run.startedAt) / 1000);
  const ageStr = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;
  let hostname = run.url;
  try { hostname = new URL(run.url).hostname; } catch { /* keep raw */ }

  const isCrawling = run.state === "crawling";
  const partial = run.partialCrawl ?? [];
  const maxPages = 6;
  const pct = isCrawling && partial.length > 0 ? Math.round((partial.length / maxPages) * 100) : 0;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <span className={`text-[10px] font-mono font-semibold ${STATE_COLOR[run.state] ?? "text-zinc-400"}`}>
          {run.state}
        </span>
      </div>
      <div className="mt-1 truncate text-[11px] text-zinc-300">{hostname}</div>

      {/* Progress bar during crawl */}
      {isCrawling && (
        <div className="mt-1.5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Crawled {partial.length} of {maxPages}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-sky-400/70 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Live thumbnail strip during crawl */}
      {isCrawling && partial.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {partial.map((p) => (
            <div key={p.id} className="flex-shrink-0 w-[72px]">
              <div className="h-[48px] w-[72px] overflow-hidden rounded border border-zinc-700 bg-zinc-800">
                {p.screenshot ? (
                  <img src={p.screenshot} alt={p.label} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-400" />
                  </div>
                )}
              </div>
              <div className="mt-0.5 truncate text-center font-mono text-[8px] text-zinc-500">
                {(() => { try { return new URL(p.url).pathname || "/"; } catch { return "/"; } })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isCrawling && (
        <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-500">
          <span>{run.pagesFound} pages</span>
          <span>{run.issuesFound} findings</span>
          <span>{run.issuesFiled} filed</span>
          <span className="ml-auto">{ageStr}</span>
        </div>
      )}

      {/* M25: GitHub issue links */}
      {run.issueUrls && run.issueUrls.length > 0 && (
        <a
          href={run.issueUrls[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 hover:underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          View {run.issueUrls.length} GitHub issue{run.issueUrls.length > 1 ? "s" : ""} →
        </a>
      )}

      {run.log.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            {expanded ? "hide log" : "show log"}
          </button>
          {expanded && (
            <div className="mt-1 max-h-28 overflow-y-auto rounded bg-zinc-950 p-2">
              {run.log.map((line, i) => (
                <div key={i} className="font-mono text-[10px] text-zinc-400">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SEV_BADGE: Record<string, string> = {
  high: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  medium: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  low: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
};

function TargetRow({
  target,
  lastRun,
  runDisabled,
  onToggle,
  onRemove,
  onRun,
}: {
  target: AgentTarget;
  lastRun: TargetRunSummary | null;
  runDisabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRun: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
            target.enabled
              ? "border-emerald-400/60 bg-emerald-400/20"
              : "border-zinc-700 bg-zinc-800"
          }`}
          title={target.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-zinc-200">{target.name}</div>
          <div className="truncate font-mono text-[10px] text-zinc-500">{target.url}</div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={runDisabled || !target.enabled}
          title="Run this target now"
          className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:enabled:border-violet-500/50 hover:enabled:text-violet-300 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[10px] text-zinc-700 hover:text-rose-400"
          title="Remove target"
        >
          ✕
        </button>
      </div>

      {/* M26: last run summary */}
      {lastRun && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-600">
          <span>{relativeTime(lastRun.runAt)}</span>
          {lastRun.issuesFound > 0 && (
            <>
              <span>·</span>
              <span>{lastRun.issuesFound} finding{lastRun.issuesFound !== 1 ? "s" : ""}</span>
            </>
          )}
          {lastRun.maxSeverity && (
            <>
              <span>·</span>
              <span className={`rounded border px-1 py-px text-[8px] font-semibold uppercase tracking-wider ${SEV_BADGE[lastRun.maxSeverity]}`}>
                {lastRun.maxSeverity}
              </span>
            </>
          )}
          {lastRun.state === "error" && (
            <span className="ml-auto rounded border border-rose-500/40 bg-rose-500/10 px-1 py-px text-[8px] font-semibold uppercase tracking-wider text-rose-400">
              failed
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// --- main panel ---

type Props = { onClose: () => void; onLoadIntoCanvas: (runs: AgentRun[]) => Promise<void> | void };

export function AgentPanel({ onClose, onLoadIntoCanvas }: Props) {
  const { config, save, loading } = useAgentConfig();
  const { status, startStream } = useAgentStream();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // M26: per-target run summaries
  const [targetRuns, setTargetRuns] = useState<Record<string, TargetRunSummary>>(() => {
    if (typeof window === "undefined") return {};
    const out: Record<string, TargetRunSummary> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_RUN_PREFIX)) {
        const id = k.slice(LS_RUN_PREFIX.length);
        const v = lsLoadTargetRun(id);
        if (v) out[id] = v;
      }
    }
    return out;
  });

  const isActive =
    status.current?.state &&
    !["done", "error"].includes(status.current.state);

  const handleRunNow = async (targetId?: string) => {
    setRunning(true);
    setRunError(null);
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    startStream();
    try {
      const targets = targetId
        ? config.targets.filter((t) => t.id === targetId && t.enabled)
        : config.targets.filter((t) => t.enabled);
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      if (res.ok) {
        const data = await res.json() as { runs?: AgentRun[] };

        // M26: persist per-target summaries
        const updates: Record<string, TargetRunSummary> = {};
        for (const r of data.runs ?? []) {
          const summary: TargetRunSummary = {
            runAt: r.startedAt,
            state: r.state,
            issuesFound: r.issuesFound,
            maxSeverity: maxSeverityFromRun(r),
          };
          lsSaveTargetRun(r.targetId, summary);
          updates[r.targetId] = summary;
        }
        if (Object.keys(updates).length > 0) {
          setTargetRuns((prev) => ({ ...prev, ...updates }));
        }

        const loadable = (data.runs ?? []).filter((r) => r.state === "done" && r.crawlResult);
        if (loadable.length > 0) {
          try {
            await onLoadIntoCanvas(loadable);
          } catch (canvasErr) {
            setRunError(`Canvas load failed: ${canvasErr instanceof Error ? canvasErr.message : String(canvasErr)}`);
          }
        } else {
          const failed = (data.runs ?? []).find((r) => r.state === "error");
          if (failed) setRunError(failed.error ?? "Run failed");
        }
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setRunError(err.error ?? `Server error ${res.status}`);
      }
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Network error");
    } finally {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setRunning(false);
    }
  };

  const addTarget = async () => {
    const url = newUrl.trim();
    const name = newName.trim() || new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (!url) return;
    const next: AgentConfig = {
      ...config,
      targets: [
        ...config.targets,
        { id: Math.random().toString(36).slice(2), url: url.startsWith("http") ? url : `https://${url}`, name, enabled: true },
      ],
    };
    await save(next);
    setNewUrl("");
    setNewName("");
  };

  const removeTarget = async (id: string) => {
    await save({ ...config, targets: config.targets.filter((t) => t.id !== id) });
  };

  const toggleTarget = async (id: string) => {
    await save({
      ...config,
      targets: config.targets.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    });
  };

  return (
    <motion.div
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      style={{
        width: 380, flexShrink: 0, display: "flex", flexDirection: "column",
        height: "100%", overflowY: "auto",
        background: "var(--bg-elev)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-violet-400/40 bg-violet-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-violet-300">
              <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-[13px] font-medium text-zinc-100">Autonomous Agent</span>
          {isActive && (
            <span className="flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-300">
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-violet-400" />
              live
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status */}
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Status</div>

          {/* Local run progress — shown when POST is in-flight (SSE may not get updates) */}
          {running && (
            <div className="mb-2 rounded-md border border-violet-800/40 bg-violet-900/20 p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-ping rounded-full bg-violet-400" />
                <span className="text-[11px] text-violet-300 font-medium">Crawling… {elapsed}s</span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">Results will load automatically when done.</div>
            </div>
          )}

          {/* Error display */}
          {runError && !running && (
            <div className="mb-2 rounded-md border border-rose-800/40 bg-rose-900/20 p-2 text-[11px] text-rose-300">
              {runError}
            </div>
          )}

          {loading ? (
            <div className="text-[11px] text-zinc-600">Loading…</div>
          ) : status.current && isActive ? (
            <RunCard run={status.current} label="Running" />
          ) : status.allLastRuns.length > 0 ? (
            <div className="space-y-1.5">
              {status.allLastRuns.map((r) => (
                <RunCard key={r.runId} run={r} label={r.state === "done" ? "Completed" : r.state === "error" ? "Failed" : "Last run"} />
              ))}
            </div>
          ) : status.last ? (
            <RunCard run={status.last} label="Last run" />
          ) : (
            <div className="text-[12px] text-zinc-500">No runs yet.</div>
          )}

          {/* Batch load button */}
          {(() => {
            const loadable = status.allLastRuns.filter((r) => r.state === "done" && r.crawlResult);
            if (loadable.length === 0) return null;
            const targets = loadable.map((r) => { try { return new URL(r.url).hostname; } catch { return r.url; } });
            const label = targets.length === 1
              ? targets[0]
              : `${targets[0]} +${targets.length - 1} more`;
            return (
              <button
                type="button"
                onClick={() => onLoadIntoCanvas(loadable)}
                className="mt-2 w-full rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
              >
                Load into canvas → {label}
              </button>
            );
          })()}
        </div>

        {/* Targets */}
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Watch Targets</div>
          <div className="space-y-1.5">
            {config.targets.length === 0 && (
              <div className="text-[11px] text-zinc-600">No targets yet. Add one below.</div>
            )}
            {config.targets.map((t) => (
              <TargetRow
                key={t.id}
                target={t}
                lastRun={targetRuns[t.id] ?? null}
                runDisabled={running || !!isActive}
                onToggle={() => toggleTarget(t.id)}
                onRemove={() => removeTarget(t.id)}
                onRun={() => void handleRunNow(t.id)}
              />
            ))}
          </div>

          {/* Add target */}
          <div className="mt-2.5 space-y-1.5">
            <input
              ref={addRef}
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addTarget()}
              placeholder="https://example.com"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addTarget()}
                placeholder="Name (optional)"
                className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void addTarget()}
                disabled={!newUrl.trim()}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:enabled:border-violet-400/40 hover:enabled:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Schedule</div>
          <div className="grid grid-cols-4 gap-1">
            {(["disabled", "hourly", "daily", "weekly"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void save({ ...config, schedule: s })}
                className={`rounded-md border px-2 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                  config.schedule === s
                    ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Thresholds */}
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Thresholds</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Visual diff</span>
                <span className="font-mono text-zinc-300">{config.thresholds.diffPercent}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={config.thresholds.diffPercent}
                onChange={(e) =>
                  void save({
                    ...config,
                    thresholds: { ...config.thresholds, diffPercent: Number(e.target.value) },
                  })
                }
                className="w-full accent-violet-500"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] text-zinc-400">Min severity to file</div>
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      void save({
                        ...config,
                        thresholds: { ...config.thresholds, minSeverity: s },
                      })
                    }
                    className={`flex-1 rounded-md border py-1 text-[10px] font-medium capitalize transition-colors ${
                      config.thresholds.minSeverity === s
                        ? s === "high"
                          ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
                          : s === "medium"
                          ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                          : "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Notify</div>
          <div className="space-y-2">
            {([
              { key: "github", label: "GitHub Issues", hint: "Requires AGENT_GITHUB_TOKEN env var" },
              { key: "slack", label: "Slack", hint: "Requires AGENT_SLACK_WEBHOOK env var" },
            ] as const).map(({ key, label, hint }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between" title={hint}>
                <div>
                  <div className="text-[12px] text-zinc-300">{label}</div>
                  <div className="text-[10px] text-zinc-600">{hint}</div>
                </div>
                <div
                  onClick={() =>
                    void save({
                      ...config,
                      notifications: { ...config.notifications, [key]: !config.notifications[key] },
                    })
                  }
                  className={`relative h-4 w-7 cursor-pointer rounded-full transition-colors ${
                    config.notifications[key] ? "bg-violet-500" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      config.notifications[key] ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Env var setup hints */}
        <div className="px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Env Vars</div>
          <div className="space-y-1 rounded-md border border-zinc-800 bg-zinc-900/40 p-2.5">
            {[
              "AGENT_GITHUB_TOKEN",
              "AGENT_GITHUB_OWNER",
              "AGENT_GITHUB_REPO",
              "AGENT_SLACK_WEBHOOK",
              "AGENT_WEBHOOK_SECRET",
              "UPSTASH_REDIS_REST_URL",
              "UPSTASH_REDIS_REST_TOKEN",
            ].map((v) => (
              <div key={v} className="font-mono text-[9px] text-zinc-600">{v}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer — Run Now */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={() => void handleRunNow()}
          disabled={running || !!isActive || config.targets.filter((t) => t.enabled).length === 0}
          className="w-full rounded-md border border-violet-500 bg-violet-600 py-2 text-[13px] font-medium text-white transition-colors hover:enabled:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running || isActive ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Running…
            </span>
          ) : (
            "Run Now"
          )}
        </button>
        {config.targets.filter((t) => t.enabled).length === 0 && (
          <p className="mt-1.5 text-center text-[10px] text-zinc-600">Add and enable at least one target.</p>
        )}
      </div>
    </motion.div>
  );
}
