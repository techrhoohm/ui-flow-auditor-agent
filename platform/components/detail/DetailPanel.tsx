"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Severity } from "@/lib/audit-script";
import type { AuditFinding } from "@/lib/audit-runner";
import type { ScreenNodeData } from "@/lib/fixtures";
import { MockScreen } from "@/lib/mock-screens";
import { useTestCases } from "@/lib/test-cases";
import { useScripts } from "@/lib/test-scripts";
import { ScriptsTab } from "./ScriptsTab";
import { TestCasesTab } from "./TestCasesTab";

type Tab = "findings" | "tests" | "scripts";

type Props = {
  nodeId: string | null;
  data: ScreenNodeData | null;
  findings: AuditFinding[];
  targetKey: string;
  model: string;
  onClose: () => void;
};

const severityOrder: Severity[] = ["high", "medium", "low"];

const severityChip: Record<Severity, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  low: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

const severityDot: Record<Severity, string> = {
  high: "bg-rose-400",
  medium: "bg-amber-300",
  low: "bg-sky-400",
};

const severityLabel: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const kindLabel: Record<ScreenNodeData["kind"], string> = {
  entry: "Entry surface",
  tab: "Tab",
  modal: "Modal",
  detail: "Detail screen",
};

export function DetailPanel({
  nodeId,
  data,
  findings,
  targetKey,
  model,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("findings");

  const testCases = useTestCases(targetKey, nodeId);
  const scripts = useScripts(targetKey, nodeId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTab("findings");
  }, [nodeId]);

  return (
    <AnimatePresence>
      {nodeId && data && (
        <motion.aside
          key={nodeId}
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="absolute right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
        >
          <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
            <div className="min-w-0 pr-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {kindLabel[data.kind]}
              </div>
              <h2 className="mt-0.5 truncate text-[15px] font-semibold text-zinc-100">
                {data.label}
              </h2>
              {data.nodeUrl && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                  {data.nodeUrl}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"
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
          </header>

          <div className="flex shrink-0 items-center gap-0.5 border-b border-zinc-800 bg-zinc-950/60 px-3">
            <TabButton
              active={tab === "findings"}
              onClick={() => setTab("findings")}
              label="Findings"
              count={findings.length}
            />
            <TabButton
              active={tab === "tests"}
              onClick={() => setTab("tests")}
              label="Test cases"
              count={testCases.length}
            />
            <TabButton
              active={tab === "scripts"}
              onClick={() => setTab("scripts")}
              label="Scripts"
              count={scripts.length}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "findings" && (
              <FindingsTab nodeId={nodeId} data={data} findings={findings} nodeLabel={data.label} model={model} />
            )}
            {tab === "tests" && (
              <TestCasesTab
                targetKey={targetKey}
                nodeId={nodeId}
                nodeLabel={data.label}
                nodeKind={data.kind}
                findings={findings}
                model={model}
                screenshotUrl={data.screenshotUrl ?? null}
                nodeUrl={data.nodeUrl ?? null}
              />
            )}
            {tab === "scripts" && (
              <ScriptsTab
                targetKey={targetKey}
                nodeId={nodeId}
                nodeUrl={data.nodeUrl ?? null}
                nodeLabel={data.label}
                model={model}
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  disabled,
  tooltip,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
        active
          ? "text-violet-200"
          : "text-zinc-400 hover:text-zinc-200"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={`rounded-full px-1.5 text-[10px] font-mono ${
            active
              ? "bg-violet-500/20 text-violet-200"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {count}
        </span>
      )}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-px bg-violet-300" />
      )}
    </button>
  );
}

function FindingsTab({
  nodeId,
  data,
  findings,
  nodeLabel,
  model,
}: {
  nodeId: string;
  data: ScreenNodeData;
  findings: AuditFinding[];
  nodeLabel: string;
  model: string;
}) {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const explain = async (key: string, message: string, severity: string) => {
    if (explanations[key] || loading[key]) return;
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, severity, nodeLabel, model }),
      });
      const data = await res.json() as { explanation?: string; error?: string };
      setExplanations((prev) => ({ ...prev, [key]: data.explanation ?? data.error ?? "No explanation." }));
    } catch {
      setExplanations((prev) => ({ ...prev, [key]: "Request failed." }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  findings.forEach((f) => counts[f.severity]++);

  const grouped: Record<Severity, AuditFinding[]> = {
    high: [],
    medium: [],
    low: [],
  };
  findings.forEach((f) => grouped[f.severity].push(f));

  return (
    <div className="px-5 pb-6">
      <div className="mt-5 flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        {data.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.screenshotUrl}
            alt={data.label}
            className="max-h-[420px] w-full rounded-md object-contain"
          />
        ) : (
          <div className="h-[280px] w-[156px]">
            <MockScreen screenId={nodeId} />
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <SummaryStat label="High" value={counts.high} tint="rose" />
        <SummaryStat label="Med" value={counts.medium} tint="amber" />
        <SummaryStat label="Low" value={counts.low} tint="sky" />
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          Findings ({findings.length})
        </div>

        {findings.length === 0 ? (
          <p className="mt-2 text-[12px] text-zinc-500">
            No findings on this screen yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {severityOrder.flatMap((sev) =>
              grouped[sev].map((f, i) => {
                const key = `${sev}-${i}-${f.at}`;
                const explanation = explanations[key];
                const isLoading = loading[key];
                return (
                  <li
                    key={key}
                    className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${severityChip[sev]}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${severityDot[sev]}`}
                        />
                        {severityLabel[sev]}
                      </span>
                      <div className="flex items-center gap-2">
                        {!explanation && (
                          <button
                            type="button"
                            onClick={() => explain(key, f.message, sev)}
                            disabled={isLoading}
                            className="text-[10px] font-medium text-violet-400 hover:text-violet-200 disabled:cursor-wait disabled:opacity-50"
                          >
                            {isLoading ? "Asking Nora…" : "Explain"}
                          </button>
                        )}
                        <span className="font-mono text-[10px] text-zinc-500">
                          {new Date(f.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-zinc-200">
                      {f.message}
                    </p>
                    {explanation && (
                      <div className="mt-2 rounded-md border border-violet-400/20 bg-violet-500/5 px-3 py-2">
                        <div className="mb-1 text-[9px] uppercase tracking-wider text-violet-400">Nora</div>
                        <p className="text-[11px] leading-relaxed text-zinc-300 whitespace-pre-line">
                          {explanation}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: "rose" | "amber" | "sky";
}) {
  const ring =
    tint === "rose"
      ? "border-rose-500/30"
      : tint === "amber"
      ? "border-amber-500/30"
      : "border-sky-500/30";
  const text =
    tint === "rose"
      ? "text-rose-300"
      : tint === "amber"
      ? "text-amber-200"
      : "text-sky-300";

  return (
    <div className={`rounded-md border ${ring} bg-zinc-900/60 px-3 py-2`}>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[18px] font-semibold ${text}`}>
        {value}
      </div>
    </div>
  );
}
