"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { downloadMarkdown, renderRunMarkdown } from "@/lib/qa-export";
import {
  finishRun,
  setResult,
  summarize,
  type QARun,
  type QAStatus,
} from "@/lib/qa-runs";
import { getTestCaseCounts, getTestCases, type TestCase } from "@/lib/test-cases";

type NodeMeta = { id: string; label: string };

type Props = {
  open: boolean;
  run: QARun | null;
  targetKey: string;
  targetLabel: string;
  nodes: NodeMeta[];
  onClose: () => void;
};

const STATUS_OPTIONS: QAStatus[] = ["pass", "fail", "blocked", "skipped"];

const STATUS_STYLE: Record<QAStatus, string> = {
  pending:
    "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
  pass:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25",
  fail:
    "border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
  blocked:
    "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25",
  skipped:
    "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
};

const STATUS_LABEL: Record<QAStatus, string> = {
  pending: "Pending",
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  skipped: "Skip",
};

export function QARunModal({
  open,
  run,
  targetKey,
  targetLabel,
  nodes,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const [byCase, setByCase] = useState<Record<string, { case: TestCase; nodeLabel: string }>>({});
  useEffect(() => {
    if (!run) { setByCase({}); return; }
    const nodeLabelById = new Map(nodes.map((n) => [n.id, n.label] as const));
    void (async () => {
      const map: Record<string, { case: TestCase; nodeLabel: string }> = {};
      const seen = new Set<string>();
      for (const r of run.results) {
        if (seen.has(r.testCaseId)) continue;
        seen.add(r.testCaseId);
        const cases = await getTestCases(targetKey, r.nodeId);
        const found = cases.find((c) => c.id === r.testCaseId);
        if (!found) continue;
        map[r.testCaseId] = { case: found, nodeLabel: nodeLabelById.get(r.nodeId) ?? r.nodeId };
      }
      setByCase(map);
    })();
  }, [run, nodes, targetKey]);

  const summary = useMemo(() => (run ? summarize(run) : null), [run]);

  const grouped = useMemo(() => {
    if (!run) return [] as Array<{ nodeId: string; nodeLabel: string; results: QARun["results"] }>;
    const nodeLabelById = new Map(nodes.map((n) => [n.id, n.label] as const));
    const map = new Map<string, QARun["results"]>();
    for (const r of run.results) {
      const list = map.get(r.nodeId) ?? [];
      list.push(r);
      map.set(r.nodeId, list);
    }
    return Array.from(map.entries()).map(([nodeId, results]) => ({
      nodeId,
      nodeLabel: nodeLabelById.get(nodeId) ?? nodeId,
      results,
    }));
  }, [run, nodes]);

  const exportMd = () => {
    if (!run) return;
    const md = renderRunMarkdown({ run, targetLabel, byCase });
    const safe = targetLabel.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    const stamp = new Date(run.startedAt).toISOString().replace(/[:.]/g, "-");
    downloadMarkdown(`qa-${safe}-${stamp}.md`, md);
  };

  return (
    <AnimatePresence>
      {open && run && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="my-8 flex h-[calc(100vh-64px)] w-[min(960px,calc(100vw-64px))] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Manual QA run
                </div>
                <h2 className="mt-0.5 text-[16px] font-semibold text-zinc-100">
                  {targetLabel}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                  started {new Date(run.startedAt).toLocaleTimeString()} ·{" "}
                  {run.results.length} cases
                </p>
              </div>
              <div className="flex items-center gap-2">
                {summary && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Chip tint="emerald" label={`${summary.pass} pass`} />
                    <Chip tint="rose" label={`${summary.fail} fail`} />
                    <Chip tint="amber" label={`${summary.blocked} blocked`} />
                    <Chip tint="zinc" label={`${summary.skipped} skip`} />
                    <Chip
                      tint="zinc"
                      label={`${summary.evaluated}/${summary.total}`}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={exportMd}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-violet-400/40 hover:text-violet-200"
                >
                  Export .md
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void finishRun(targetKey, run.id);
                    onClose();
                  }}
                  className="rounded-md border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-200 hover:bg-violet-500/25"
                >
                  Finish
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-200"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path
                      d="M2 2 L10 10 M10 2 L2 10"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {grouped.map((group) => (
                <section key={group.nodeId} className="mb-8">
                  <header className="mb-2 flex items-center gap-2">
                    <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                      {group.nodeId}
                    </span>
                    <h3 className="text-[14px] font-semibold text-zinc-100">
                      {group.nodeLabel}
                    </h3>
                  </header>

                  <ul className="space-y-3">
                    {group.results.map((r) => {
                      const meta = byCase[r.testCaseId];
                      if (!meta) return null;
                      const tc = meta.case;
                      return (
                        <li
                          key={r.testCaseId}
                          className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-zinc-100">
                                {tc.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-zinc-500">
                                <span>{tc.priority}</span>
                                <span>·</span>
                                <span>{tc.type}</span>
                                {r.evaluatedAt && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {new Date(
                                        r.evaluatedAt
                                      ).toLocaleTimeString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {STATUS_OPTIONS.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() =>
                                    void setResult(targetKey, run.id, r.testCaseId, s)
                                  }
                                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                    r.status === s
                                      ? STATUS_STYLE[s]
                                      : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-200"
                                  }`}
                                >
                                  {STATUS_LABEL[s]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {tc.body && (
                            <pre className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                              {tc.body}
                            </pre>
                          )}

                          <textarea
                            placeholder="Notes — what you saw, links, repro steps…"
                            value={r.notes}
                            onChange={(e) =>
                              void setResult(
                                targetKey,
                                run.id,
                                r.testCaseId,
                                r.status,
                                e.target.value
                              )
                            }
                            rows={2}
                            className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {grouped.length === 0 && (
                <p className="text-[13px] text-zinc-500">
                  No test cases authored yet for {targetLabel}. Add some from
                  any node&apos;s detail panel, then start a QA run again.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chip({
  tint,
  label,
}: {
  tint: "emerald" | "rose" | "amber" | "zinc";
  label: string;
}) {
  const cls =
    tint === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tint === "rose"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
      : tint === "amber"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-zinc-700 bg-zinc-900 text-zinc-300";
  return (
    <span className={`rounded-full border px-1.5 py-0.5 ${cls}`}>{label}</span>
  );
}

export async function buildStartRunResults(
  targetKey: string,
  nodes: NodeMeta[]
): Promise<Array<{ testCaseId: string; nodeId: string }>> {
  const counts = await getTestCaseCounts(targetKey);
  const out: Array<{ testCaseId: string; nodeId: string }> = [];
  for (const n of nodes) {
    if (!counts[n.id]) continue;
    const cases = await getTestCases(targetKey, n.id);
    for (const c of cases) {
      out.push({ testCaseId: c.id, nodeId: n.id });
    }
  }
  return out;
}
