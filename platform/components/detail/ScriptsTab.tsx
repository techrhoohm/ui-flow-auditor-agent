"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  createDraftScript,
  deleteScript,
  saveResult,
  upsertScript,
  useResults,
  useScripts,
  type ScriptResult,
  type ScriptRunStatus,
  type TestScript,
} from "@/lib/test-scripts";

type Props = {
  targetKey: string;
  nodeId: string;
  nodeUrl: string | null;
};

const STATUS_STYLE: Record<ScriptRunStatus, string> = {
  pass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  fail: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  error: "border-amber-500/40 bg-amber-500/10 text-amber-200",
};

const STATUS_LABEL: Record<ScriptRunStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  error: "Error",
};

type Draft = ReturnType<typeof createDraftScript>;

export function ScriptsTab({ targetKey, nodeId, nodeUrl }: Props) {
  const scripts = useScripts(targetKey, nodeId);
  const results = useResults(targetKey, nodeId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());

  const canRun = !!nodeUrl;

  const startNew = () => {
    setEditingId(null);
    setDraft(createDraftScript());
  };

  const startEdit = (s: TestScript) => {
    setEditingId(s.id);
    setDraft({ id: s.id, name: s.name, body: s.body });
  };

  const save = () => {
    if (!draft || !draft.name.trim() || !draft.body.trim()) return;
    upsertScript(targetKey, nodeId, draft);
    setDraft(null);
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (!confirm("Delete this script and its last result?")) return;
    deleteScript(targetKey, nodeId, id);
    if (editingId === id) {
      setDraft(null);
      setEditingId(null);
    }
  };

  const run = async (script: TestScript) => {
    if (!nodeUrl) return;
    setRunning((prev) => {
      const next = new Set(prev);
      next.add(script.id);
      return next;
    });
    try {
      const res = await fetch("/api/test/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: script.body, url: nodeUrl }),
      });
      const data = (await res.json()) as ScriptResult & { error?: string };
      if (!res.ok) {
        saveResult(targetKey, nodeId, script.id, {
          status: "error",
          durationMs: data.durationMs ?? 0,
          logs: data.logs ?? [],
          error: data.error ?? `HTTP ${res.status}`,
          ranAt: Date.now(),
        });
      } else {
        saveResult(targetKey, nodeId, script.id, {
          ...data,
          ranAt: Date.now(),
        });
      }
    } catch (err) {
      saveResult(targetKey, nodeId, script.id, {
        status: "error",
        durationMs: 0,
        logs: [],
        error: err instanceof Error ? err.message : String(err),
        ranAt: Date.now(),
      });
    } finally {
      setRunning((prev) => {
        const next = new Set(prev);
        next.delete(script.id);
        return next;
      });
    }
  };

  return (
    <div className="px-5 pb-6">
      {!canRun && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          Scripts run against a live URL. Use the Web URL target with this node
          to enable execution. You can still author scripts here for later.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Scripts ({scripts.length})
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Per-node Playwright bodies. <code className="font-mono text-zinc-300">page</code>,{" "}
            <code className="font-mono text-zinc-300">url</code>,{" "}
            <code className="font-mono text-zinc-300">expect</code>,{" "}
            <code className="font-mono text-zinc-300">console</code> in scope.
          </p>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={startNew}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-violet-400/40 hover:text-violet-200"
          >
            + Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {draft && (
          <motion.div
            key="draft"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-4 rounded-md border border-violet-400/30 bg-zinc-900/80 p-3"
          >
            <input
              type="text"
              autoFocus
              placeholder="Script name — e.g. Search bar accepts input"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, name: e.target.value } : d))
              }
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
            />
            <textarea
              value={draft.body}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, body: e.target.value } : d))
              }
              rows={10}
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-200 focus:border-violet-400/50 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                }}
                className="rounded-md border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!draft.name.trim() || !draft.body.trim()}
                className="rounded-md border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {scripts.length === 0 && !draft ? (
        <p className="mt-4 text-[12px] text-zinc-500">
          No scripts yet. Write a Playwright script body and run it against the
          live URL — pass/fail badges show up on the canvas and in the Run column
          below.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {scripts.map((s) => {
            const result = results[s.id];
            const isRunning = running.has(s.id);
            return (
              <li
                key={s.id}
                className={`rounded-md border bg-zinc-900/60 p-3 transition-colors ${
                  editingId === s.id
                    ? "border-violet-400/40"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="flex-1 truncate text-left text-[13px] font-medium text-zinc-100 hover:text-violet-200"
                  >
                    {s.name}
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {result && (
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${STATUS_STYLE[result.status]}`}
                      >
                        {STATUS_LABEL[result.status]} · {result.durationMs}ms
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => run(s)}
                      disabled={!canRun || isRunning}
                      className="rounded-md border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-200 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRunning ? "Running…" : "Run"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      aria-label="Delete script"
                      title="Delete"
                      className="text-zinc-600 transition-colors hover:text-rose-300"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path
                          d="M3 4h6v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM2 3h8M5 2h2"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {result?.error && (
                  <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-rose-200">
                    {result.error}
                  </p>
                )}

                {result?.logs && result.logs.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
                      Logs ({result.logs.length})
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[10px] leading-relaxed text-zinc-300">
                      {result.logs
                        .map(
                          (l) =>
                            `[${String(l.at).padStart(5, " ")}ms] ${l.level.toUpperCase()}  ${l.message}`
                        )
                        .join("\n")}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
