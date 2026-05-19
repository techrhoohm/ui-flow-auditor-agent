"use client";

import {
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetailPanel } from "@/components/detail/DetailPanel";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { PointingLine } from "@/components/flow/PointingLine";
import { Nora } from "@/components/nora/Nora";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar, type AuditTarget } from "@/components/shell/Topbar";
import type { AuditScript } from "@/lib/audit-script";
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
import { useTestCaseCounts } from "@/lib/test-cases";

const NORA_ORIGIN_OFFSET = { x: 72, y: -72 };

function deriveTargetKey(target: AuditTarget, urlInput: string): string {
  if (target === "demo") return "demo";
  if (target === "vitalsapp") return "vitalsapp";
  if (!urlInput) return "url:pending";
  try {
    const trimmed = urlInput.trim();
    const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).origin;
  } catch {
    return "url:invalid";
  }
}

type UrlAuditResponse = {
  script: AuditScript;
  nodes: Array<{
    id: string;
    label: string;
    kind: ScreenNodeData["kind"];
    position: { x: number; y: number };
    hasScreenshot: boolean;
  }>;
  edges: Array<{ source: string; target: string }>;
  screenshots: Record<string, string>;
};

export default function Page() {
  return (
    <ReactFlowProvider>
      <Dashboard />
    </ReactFlowProvider>
  );
}

function Dashboard() {
  const [nodes, setNodes] = useState<Node<ScreenNodeData>[]>(vitalsAppNodes);
  const [edges, setEdges] = useState<Edge[]>(vitalsAppEdges);
  const [history, setHistory] = useState<AuditRunResult[]>([]);
  const [findingsByNode, setFindingsByNode] = useState<
    Record<string, AuditFinding[]>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [target, setTarget] = useState<AuditTarget>("demo");
  const [urlInput, setUrlInput] = useState("");

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

  // Swap the canvas to the fixture set when target changes back to demo / vitalsapp.
  useEffect(() => {
    if (target === "demo" || target === "vitalsapp") {
      setNodes(
        vitalsAppNodes.map((n) => ({
          ...n,
          data: { ...n.data, issueCount: 0, screenshotUrl: null },
        }))
      );
      setEdges(vitalsAppEdges);
    }
  }, [target]);

  const resetCanvas = useCallback(() => {
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
  }, []);

  const swapToDynamic = useCallback((res: UrlAuditResponse) => {
    const dynamicNodes: Node<ScreenNodeData>[] = res.nodes.map((n) => ({
      id: n.id,
      type: "screen",
      position: n.position,
      data: {
        label: n.label,
        kind: n.kind,
        issueCount: 0,
        thumbnailSeed: n.id,
        screenshotUrl: res.screenshots[n.id] ?? null,
        isActive: false,
        flashSeverity: null,
      },
    }));
    const dynamicEdges: Edge[] = res.edges.map((e, i) => ({
      id: `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
    }));
    setNodes(dynamicNodes);
    setEdges(dynamicEdges);
    setFindingsByNode({});
  }, []);

  const handleStart = useCallback(async () => {
    if (target === "demo") {
      resetCanvas();
      run.start();
      return;
    }

    if (target === "vitalsapp") {
      resetCanvas();
      run.prepare("Reading VitalsApp source.");
      try {
        const res = await fetch("/api/audit/vitalsapp", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const { script } = (await res.json()) as { script: AuditScript };
        run.start(script);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        run.fail(`Source unreachable. ${msg}`);
      }
      return;
    }

    // target === "url"
    if (!urlInput) {
      run.fail("No URL.");
      return;
    }
    run.prepare(`Crawling ${truncate(urlInput, 40)}.`);
    try {
      const res = await fetch("/api/audit/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput, maxPages: 6 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as UrlAuditResponse;
      swapToDynamic(data);
      // Small tick so React commits the new nodes before the script plays.
      setTimeout(() => run.start(data.script), 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      run.fail(`Crawl failed. ${msg}`);
    }
  }, [resetCanvas, run, swapToDynamic, target, urlInput]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
    [selectedNodeId, nodes]
  );

  const targetKey = useMemo(
    () => deriveTargetKey(target, urlInput),
    [target, urlInput]
  );
  const testCaseCounts = useTestCaseCounts(targetKey);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const tcCount = testCaseCounts[n.id] ?? 0;
        if (n.data.testCaseCount === tcCount) return n;
        return { ...n, data: { ...n.data, testCaseCount: tcCount } };
      })
    );
  }, [testCaseCounts]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#08080a] text-zinc-100">
      <Topbar
        running={run.running}
        target={target}
        url={urlInput}
        onTargetChange={setTarget}
        onUrlChange={setUrlInput}
        onStart={handleStart}
        onStop={run.stop}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          running={run.running}
          progress={run.progress}
          history={history}
        />

        <main className="relative flex-1 overflow-hidden">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
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
            targetKey={targetKey}
            onClose={() => setSelectedNodeId(null)}
          />
        </main>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
