"use client";

import {
  ReactFlowProvider,
  applyNodeChanges,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetailPanel } from "@/components/detail/DetailPanel";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { PointingLine } from "@/components/flow/PointingLine";
import { Nora } from "@/components/nora/Nora";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { vitalsAppScript } from "@/lib/audit-script";
import {
  useAuditRun,
  type AuditFinding,
  type AuditRunResult,
} from "@/lib/audit-runner";
import {
  vitalsAppEdges,
  vitalsAppNodes,
  type ScreenNodeData,
} from "@/lib/fixtures";

const NORA_ORIGIN_OFFSET = { x: 72, y: -72 };

export default function Page() {
  return (
    <ReactFlowProvider>
      <Dashboard />
    </ReactFlowProvider>
  );
}

function Dashboard() {
  const [nodes, setNodes] = useState<Node<ScreenNodeData>[]>(vitalsAppNodes);
  const [history, setHistory] = useState<AuditRunResult[]>([]);
  const [findingsByNode, setFindingsByNode] = useState<
    Record<string, AuditFinding[]>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const noraAnchorRef = useRef<HTMLDivElement | null>(null);
  const [noraOrigin, setNoraOrigin] = useState<{ x: number; y: number } | null>(
    null
  );

  const run = useAuditRun(vitalsAppScript);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<ScreenNodeData>[]);
    },
    []
  );

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isActive: n.id === run.currentNodeId,
          flashSeverity: n.id === run.flashNodeId ? run.flashSeverity : null,
        },
      }))
    );
  }, [run.currentNodeId, run.flashNodeId, run.flashSeverity]);

  useEffect(() => {
    const unsub = run.onFinding((f) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === f.nodeId
            ? { ...n, data: { ...n.data, issueCount: n.data.issueCount + 1 } }
            : n
        )
      );
      setFindingsByNode((prev) => ({
        ...prev,
        [f.nodeId]: [...(prev[f.nodeId] ?? []), f],
      }));
    });
    return unsub;
  }, [run]);

  useEffect(() => {
    const unsub = run.onComplete((r) => {
      setHistory((h) => [r, ...h].slice(0, 12));
    });
    return unsub;
  }, [run]);

  useEffect(() => {
    const measure = () => {
      const el = noraAnchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setNoraOrigin({
        x: rect.left + NORA_ORIGIN_OFFSET.x,
        y: rect.top + NORA_ORIGIN_OFFSET.y,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleStart = useCallback(() => {
    setFindingsByNode({});
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          issueCount: 0,
          isActive: false,
          flashSeverity: null,
        },
      }))
    );
    run.start();
  }, [run]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
    [selectedNodeId, nodes]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#08080a] text-zinc-100">
      <Topbar running={run.running} onStart={handleStart} onStop={run.stop} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          running={run.running}
          progress={run.progress}
          history={history}
        />

        <main className="relative flex-1 overflow-hidden">
          <FlowCanvas
            nodes={nodes}
            edges={vitalsAppEdges}
            onNodesChange={onNodesChange}
            onNodeClick={(id) => setSelectedNodeId(id)}
          />

          <PointingLine
            activeNodeId={run.currentNodeId}
            origin={noraOrigin}
          />

          <div
            ref={noraAnchorRef}
            className="pointer-events-none absolute bottom-6 left-6 z-30"
          >
            <Nora snapshot={run.snapshot} />
          </div>

          <DetailPanel
            nodeId={selectedNodeId}
            data={selectedNode?.data ?? null}
            findings={selectedNodeId ? findingsByNode[selectedNodeId] ?? [] : []}
            onClose={() => setSelectedNodeId(null)}
          />
        </main>
      </div>
    </div>
  );
}
