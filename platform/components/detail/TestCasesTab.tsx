"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import {
  createDraft,
  deleteTestCase,
  importTestCases,
  upsertTestCase,
  useTestCases,
  type Priority,
  type TestCase,
  type TestType,
} from "@/lib/test-cases";
import {
  parseCsvTestCases,
  parseJsonTestCases,
  parseMdTestCases,
} from "@/lib/import-parsers";
import { TemplatePicker } from "@/components/detail/TemplatePicker";

type AuditFinding = { message: string; severity: string };

type EvalResult = {
  id: string;
  status: "pass" | "fail" | "blocked" | "skip";
  reasoning: string;
};

type Props = {
  targetKey: string;
  nodeId: string;
  nodeLabel: string;
  nodeKind: string;
  findings: AuditFinding[];
  model: string;
  screenshotUrl: string | null;
  nodeUrl: string | null;
};

const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2"];
const TYPE_OPTIONS: TestType[] = ["functional", "visual", "a11y", "perf"];

const PRIORITY_STYLE: Record<Priority, string> = {
  P0: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  P1: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  P2: "border-zinc-700 bg-zinc-900 text-zinc-300",
};

const TYPE_STYLE: Record<TestType, string> = {
  functional: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  visual: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  a11y: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  perf: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
};

const TYPE_LABEL: Record<TestType, string> = {
  functional: "Functional",
  visual: "Visual",
  a11y: "A11y",
  perf: "Perf",
};

type DraftState = ReturnType<typeof createDraft>;

type SuggestedCase = {
  title: string;
  body: string;
  priority: Priority;
  type: TestType;
};

const EVAL_STATUS_STYLE: Record<EvalResult["status"], string> = {
  pass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  fail: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  blocked: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  skip: "border-zinc-700 bg-zinc-900 text-zinc-400",
};
const EVAL_STATUS_LABEL: Record<EvalResult["status"], string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  skip: "Skip",
};

export function TestCasesTab({ targetKey, nodeId, nodeLabel, nodeKind, findings, model, screenshotUrl, nodeUrl }: Props) {
  const cases = useTestCases(targetKey, nodeId);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedCase[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  // AI evaluation runner state
  const [evalResults, setEvalResults] = useState<Record<string, EvalResult>>({});
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());

  const runEvaluation = async (subset?: TestCase[]) => {
    const toRun = subset ?? cases;
    if (toRun.length === 0) return;
    setEvalRunning(true);
    setEvalError(null);
    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCases: toRun.map((tc) => ({ id: tc.id, title: tc.title, body: tc.body, priority: tc.priority, type: tc.type })),
          screenshotUrl,
          nodeUrl,
          nodeLabel,
          model,
        }),
      });
      const data = await res.json() as { results?: EvalResult[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      const map: Record<string, EvalResult> = {};
      for (const r of data.results ?? []) map[r.id] = r;
      setEvalResults((prev) => ({ ...prev, ...map }));
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvalRunning(false);
    }
  };

  const toggleReasoning = (id: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearResults = () => {
    setEvalResults({});
    setExpandedReasoning(new Set());
    setEvalError(null);
  };

  const askNora = async () => {
    setSuggesting(true);
    setSuggestions([]);
    setSuggestError(null);
    setAccepted(new Set());
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, nodeLabel, nodeKind, findings, model }),
      });
      const data = await res.json() as { suggestions?: SuggestedCase[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuggestions(data.suggestions ?? []);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = (i: number) => {
    const s = suggestions[i];
    if (!s) return;
    void importTestCases(targetKey, nodeId, [s]);
    setAccepted((prev) => new Set([...prev, i]));
  };

  const acceptAll = () => {
    const remaining = suggestions.filter((_, i) => !accepted.has(i));
    if (remaining.length > 0) {
      void importTestCases(targetKey, nodeId, remaining);
      setAccepted(new Set(suggestions.map((_, i) => i)));
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        let parsed;
        if (file.name.endsWith(".json")) parsed = parseJsonTestCases(text);
        else if (file.name.endsWith(".csv")) parsed = parseCsvTestCases(text);
        else if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) parsed = parseMdTestCases(text);
        else throw new Error("Unsupported format. Use .json, .csv, or .md");
        const count = await importTestCases(targetKey, nodeId, parsed);
        setImportMsg({ text: `Imported ${count} case${count === 1 ? "" : "s"}`, ok: true });
      } catch (err) {
        setImportMsg({ text: err instanceof Error ? err.message : "Import failed", ok: false });
      }
      setTimeout(() => setImportMsg(null), 3500);
    };
    reader.readAsText(file);
  };

  const startNew = () => {
    setEditingId(null);
    setDraft(createDraft());
  };

  const startEdit = (tc: TestCase) => {
    setEditingId(tc.id);
    setDraft({
      id: tc.id,
      title: tc.title,
      body: tc.body,
      priority: tc.priority,
      type: tc.type,
    });
  };

  const save = () => {
    if (!draft || !draft.title.trim()) return;
    void upsertTestCase(targetKey, nodeId, draft);
    setDraft(null);
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (!confirm("Delete this test case?")) return;
    void deleteTestCase(targetKey, nodeId, id);
    if (editingId === id) {
      setDraft(null);
      setEditingId(null);
    }
  };

  const handlePickerAdd = async (
    items: { title: string; body: string; priority: Priority; type: TestType }[]
  ) => {
    if (items.length === 0) return;
    const count = await importTestCases(targetKey, nodeId, items);
    setImportMsg({ text: `Added ${count} template${count === 1 ? "" : "s"}`, ok: true });
    setTimeout(() => setImportMsg(null), 3500);
  };

  return (
    <div className="px-5 pb-6">
      {showPicker && (
        <TemplatePicker
          mode="cases"
          onAdd={handlePickerAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv,.md,.markdown"
        className="hidden"
        onChange={handleFileImport}
      />

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Test cases ({cases.length})
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Stored in this browser. Linked to {nodeId} on {shortTarget(targetKey)}.
          </p>
        </div>
        {!draft && (
          <div className="flex items-center gap-1.5">
            {cases.length > 0 && (
              <button
                type="button"
                onClick={() => void runEvaluation()}
                disabled={evalRunning}
                title="Run all test cases against this screen using AI"
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-50"
              >
                {evalRunning ? "Running…" : "▶ Run"}
              </button>
            )}
            {Object.keys(evalResults).length > 0 && !evalRunning && (
              <button
                type="button"
                onClick={clearResults}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={askNora}
              disabled={suggesting}
              title="Ask Nora to suggest test cases based on findings"
              className="rounded-md border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-50"
            >
              {suggesting ? "Asking…" : "✦ Ask Nora"}
            </button>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              title="Browse and add from the built-in template library"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-violet-400/40 hover:text-violet-200"
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Import from .json, .csv, or .md"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-violet-400/40 hover:text-violet-200"
            >
              Import
            </button>
            <button
              type="button"
              onClick={startNew}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:border-violet-400/40 hover:text-violet-200"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {importMsg && (
          <motion.div
            key="import-msg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`mt-2 rounded-md border px-3 py-1.5 text-[11px] ${
              importMsg.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {importMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {suggestError && (
        <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[11px] text-rose-300">
          {suggestError}
        </div>
      )}

      {evalError && (
        <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[11px] text-rose-300">
          {evalError}
        </div>
      )}

      {evalRunning && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-300">AI is evaluating test cases against this screen…</span>
        </div>
      )}

      {!evalRunning && Object.keys(evalResults).length > 0 && (() => {
        const vals = Object.values(evalResults);
        const pass = vals.filter((r) => r.status === "pass").length;
        const fail = vals.filter((r) => r.status === "fail").length;
        const blocked = vals.filter((r) => r.status === "blocked").length;
        return (
          <div className="mt-2 flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-[11px]">
            <span className="text-zinc-500">Last run:</span>
            {pass > 0 && <span className="text-emerald-300">{pass} pass</span>}
            {fail > 0 && <span className="text-rose-300">{fail} fail</span>}
            {blocked > 0 && <span className="text-amber-200">{blocked} blocked</span>}
          </div>
        );
      })()}

      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            key="suggestions"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 rounded-md border border-violet-400/25 bg-violet-500/5 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-violet-400">
                Nora suggests ({suggestions.length})
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="text-[10px] font-medium text-violet-300 hover:text-violet-100"
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestions([])}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {suggestions.map((s, i) => {
                const isAccepted = accepted.has(i);
                return (
                  <li key={i} className={`rounded-md border p-2.5 transition-colors ${isAccepted ? "border-emerald-500/25 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/60"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-[12px] font-medium ${isAccepted ? "text-zinc-400 line-through" : "text-zinc-100"}`}>
                          {s.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px]">
                          <span className={`rounded-full border px-1.5 py-0.5 ${PRIORITY_STYLE[s.priority]}`}>{s.priority}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 ${TYPE_STYLE[s.type]}`}>{TYPE_LABEL[s.type]}</span>
                        </div>
                      </div>
                      {!isAccepted && (
                        <button
                          type="button"
                          onClick={() => acceptSuggestion(i)}
                          className="shrink-0 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 hover:bg-violet-500/20"
                        >
                          Accept
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

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
              placeholder="Title — e.g. New user can complete onboarding"
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, title: e.target.value } : d))
              }
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
            />
            <textarea
              placeholder={"Steps & expected outcome. Markdown OK.\n1. Go to Home\n2. Tap the bell icon\n3. Expect: notifications screen opens"}
              value={draft.body}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, body: e.target.value } : d))
              }
              rows={5}
              className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[12px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SegmentedSelect
                label="Priority"
                value={draft.priority}
                options={PRIORITY_OPTIONS}
                onChange={(v) =>
                  setDraft((d) =>
                    d ? { ...d, priority: v as Priority } : d
                  )
                }
              />
              <SegmentedSelect
                label="Type"
                value={draft.type}
                options={TYPE_OPTIONS}
                onChange={(v) =>
                  setDraft((d) =>
                    d ? { ...d, type: v as TestType } : d
                  )
                }
                renderLabel={(o) => TYPE_LABEL[o as TestType]}
              />
              <div className="ml-auto flex items-center gap-2">
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
                  disabled={!draft.title.trim()}
                  className="rounded-md border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {cases.length === 0 && !draft ? (
        <p className="mt-4 text-[12px] text-zinc-500">
          No test cases yet. Use them to capture what this screen needs to do —
          they&apos;ll drive the manual QA checklist (M8) and seed automated
          scripts (M7).
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {cases.map((tc) => {
            const result = evalResults[tc.id];
            const reasoningOpen = expandedReasoning.has(tc.id);
            return (
              <li
                key={tc.id}
                className={`rounded-md border bg-zinc-900/60 p-3 transition-colors ${
                  editingId === tc.id
                    ? "border-violet-400/40"
                    : result?.status === "fail"
                    ? "border-rose-500/30"
                    : result?.status === "pass"
                    ? "border-emerald-500/30"
                    : result?.status === "blocked"
                    ? "border-amber-500/30"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => startEdit(tc)}
                      className="block w-full text-left text-[13px] font-medium text-zinc-100 hover:text-violet-200"
                    >
                      {tc.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-mono ${PRIORITY_STYLE[tc.priority]}`}>
                        {tc.priority}
                      </span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${TYPE_STYLE[tc.type]}`}>
                        {TYPE_LABEL[tc.type]}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {new Date(tc.updatedAt).toLocaleDateString()}
                      </span>
                      {result && (
                        <button
                          type="button"
                          onClick={() => toggleReasoning(tc.id)}
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium transition-opacity hover:opacity-80 ${EVAL_STATUS_STYLE[result.status]}`}
                        >
                          {EVAL_STATUS_LABEL[result.status]}
                        </button>
                      )}
                      {evalRunning && !result && (
                        <span className="font-mono text-[9px] text-zinc-500 animate-pulse">evaluating…</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {cases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void runEvaluation([tc])}
                        disabled={evalRunning}
                        title="Run only this test case"
                        className="text-[10px] text-zinc-500 hover:text-emerald-300 disabled:opacity-40"
                      >
                        ▶
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(tc.id)}
                      aria-label="Delete test case"
                      className="text-zinc-600 transition-colors hover:text-rose-300"
                      title="Delete"
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
                {tc.body && (
                  <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {tc.body}
                  </pre>
                )}
                {result && reasoningOpen && (
                  <div className={`mt-2 rounded-md border px-3 py-2 text-[11px] leading-relaxed ${EVAL_STATUS_STYLE[result.status]}`}>
                    <div className="mb-0.5 text-[9px] uppercase tracking-wider opacity-60">Nora&apos;s reasoning</div>
                    {result.reasoning}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SegmentedSelect({
  label,
  value,
  options,
  onChange,
  renderLabel,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  renderLabel?: (o: string) => string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? "bg-violet-500/15 text-violet-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {renderLabel ? renderLabel(o) : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shortTarget(targetKey: string) {
  if (targetKey === "demo") return "Demo";
  if (targetKey === "vitalsapp") return "VitalsApp";
  return targetKey.replace(/^https?:\/\//, "");
}
