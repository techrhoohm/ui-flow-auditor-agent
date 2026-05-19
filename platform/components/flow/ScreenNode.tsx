"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { Severity } from "@/lib/audit-script";
import type { ScreenNodeData } from "@/lib/fixtures";
import { MockScreen } from "@/lib/mock-screens";

type ScreenNodeType = Node<ScreenNodeData, "screen">;

const kindStyles: Record<ScreenNodeData["kind"], string> = {
  entry:
    "border-violet-400/40 bg-gradient-to-b from-violet-500/10 to-zinc-900/80",
  tab: "border-zinc-700/70 bg-zinc-900/85",
  modal: "border-amber-500/40 bg-zinc-900/85",
  detail: "border-sky-500/40 bg-zinc-900/85",
};

const kindLabel: Record<ScreenNodeData["kind"], string> = {
  entry: "Entry",
  tab: "Tab",
  modal: "Modal",
  detail: "Detail",
};

const severityRing: Record<Severity, string> = {
  low: "ring-sky-400/60",
  medium: "ring-amber-400/70",
  high: "ring-rose-400/80",
};

const severityFlashBg: Record<Severity, string> = {
  low: "bg-sky-500/20",
  medium: "bg-amber-500/25",
  high: "bg-rose-500/30",
};

export function ScreenNode({ id, data }: NodeProps<ScreenNodeType>) {
  const active = !!data.isActive;
  const flash = data.flashSeverity ?? null;

  return (
    <div className="relative cursor-pointer">
      {active && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-xl border border-violet-300/70"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.02, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div
        className={`relative w-[148px] rounded-lg border ${kindStyles[data.kind]} px-3 py-3 shadow-md transition-colors ${
          active ? "border-violet-300/80" : "hover:border-zinc-500"
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-1.5 !w-1.5 !border-0 !bg-zinc-500"
        />

        <div className="relative mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-950">
          {data.screenshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.screenshotUrl}
              alt={data.label}
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
          ) : (
            <div className="h-full w-[60%]">
              <MockScreen screenId={id} />
            </div>
          )}
          {flash && (
            <motion.div
              key={`${flash}-${data.issueCount}`}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className={`pointer-events-none absolute inset-0 ${severityFlashBg[flash]} ring-1 ${severityRing[flash]}`}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {kindLabel[data.kind]}
            </div>
            <div className="truncate text-[13px] font-medium text-zinc-100">
              {data.label}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <RegressionBadge pct={typeof data.regressionPct === "number" ? data.regressionPct : null} />
            <ScriptBadge summary={data.scriptSummary} />
            {data.testCaseCount && data.testCaseCount > 0 ? (
              <span
                title={`${data.testCaseCount} test case${data.testCaseCount === 1 ? "" : "s"}`}
                className="rounded-full border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-mono text-violet-300"
              >
                TC {data.testCaseCount}
              </span>
            ) : null}
            <IssueBadge count={data.issueCount} />
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-1.5 !w-1.5 !border-0 !bg-zinc-500"
        />
      </div>
    </div>
  );
}

function RegressionBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct < 1) return null;
  const isHigh = pct >= 5;
  const cls = isHigh
    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
    : "border-amber-500/40 bg-amber-500/10 text-amber-200";
  const label = `Δ${pct.toFixed(0)}%`;
  return (
    <motion.span
      key={pct}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      title={`Visual regression: ~${pct.toFixed(1)}% pixels changed`}
      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}
    >
      {label}
    </motion.span>
  );
}

function ScriptBadge({
  summary,
}: {
  summary?: ScreenNodeData["scriptSummary"];
}) {
  if (!summary || summary.total === 0) return null;
  const ranAny = summary.pass + summary.fail + summary.error > 0;
  if (!ranAny) {
    return (
      <span
        title={`${summary.total} script${summary.total === 1 ? "" : "s"} authored, none run yet`}
        className="rounded-full border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
      >
        S 0/{summary.total}
      </span>
    );
  }
  const allPass = summary.pass === summary.total;
  const anyFail = summary.fail > 0 || summary.error > 0;
  const cls = allPass
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    : anyFail
    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
    : "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return (
    <span
      title={`${summary.pass} pass · ${summary.fail} fail · ${summary.error} error of ${summary.total}`}
      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}
    >
      S {summary.pass}/{summary.total}
    </span>
  );
}

function IssueBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="rounded-full border border-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
        0
      </span>
    );
  }
  return (
    <motion.span
      key={count}
      initial={{ scale: 1.4 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-full border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono text-rose-300"
    >
      {count}
    </motion.span>
  );
}
