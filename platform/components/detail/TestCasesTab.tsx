"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  createDraft,
  deleteTestCase,
  upsertTestCase,
  useTestCases,
  type Priority,
  type TestCase,
  type TestType,
} from "@/lib/test-cases";

type Props = {
  targetKey: string;
  nodeId: string;
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

export function TestCasesTab({ targetKey, nodeId }: Props) {
  const cases = useTestCases(targetKey, nodeId);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    upsertTestCase(targetKey, nodeId, draft);
    setDraft(null);
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (!confirm("Delete this test case?")) return;
    deleteTestCase(targetKey, nodeId, id);
    if (editingId === id) {
      setDraft(null);
      setEditingId(null);
    }
  };

  return (
    <div className="px-5 pb-6">
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
          {cases.map((tc) => (
            <li
              key={tc.id}
              className={`rounded-md border bg-zinc-900/60 p-3 transition-colors ${
                editingId === tc.id
                  ? "border-violet-400/40"
                  : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => startEdit(tc)}
                    className="block w-full text-left text-[13px] font-medium text-zinc-100 hover:text-violet-200"
                  >
                    {tc.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-mono ${PRIORITY_STYLE[tc.priority]}`}
                    >
                      {tc.priority}
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] ${TYPE_STYLE[tc.type]}`}
                    >
                      {TYPE_LABEL[tc.type]}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {new Date(tc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
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
              {tc.body && (
                <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {tc.body}
                </pre>
              )}
            </li>
          ))}
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
