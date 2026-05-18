"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ScreenNodeData } from "@/lib/fixtures";

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

export function ScreenNode({ data }: NodeProps<ScreenNodeType>) {
  return (
    <div
      className={`w-[148px] rounded-lg border ${kindStyles[data.kind]} px-3 py-3 shadow-md transition-colors hover:border-zinc-500`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-0 !bg-zinc-500"
      />

      <div className="mb-2 h-16 w-full overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-950">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, rgba(167,139,250,0.18), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 6px)",
          }}
        />
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
        <IssueBadge count={data.issueCount} />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-0 !bg-zinc-500"
      />
    </div>
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
    <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono text-rose-300">
      {count}
    </span>
  );
}
