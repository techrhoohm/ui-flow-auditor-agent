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
import { Topbar } from "@/components/shell/Topbar";
import type { AuditScript } from "@/lib/audit-script";
import {
  useAuditRun,
  type AuditFinding,
  type AuditRunResult,
} from "@/lib/audit-runner";
import { type ScreenNodeData } from "@/lib/fixtures";
import { useTestCaseCounts } from "@/lib/test-cases";
import { useScriptSummaries } from "@/lib/test-scripts";
import { startRun, useQAHistory } from "@/lib/qa-runs";
import { QARunModal, buildStartRunResults } from "@/components/qa/QARunModal";
import { useAIModel } from "@/lib/ai-model";
import { saveBaseline, clearBaselines, getBaseline } from "@/lib/baselines";
import { saveRegression, clearRegressions, useRegressions } from "@/lib/regressions";

const NORA_ORIGIN_OFFSET = { x: 72, y: -72 };

const EMPTY_SCRIPT: AuditScript = { target: "", events: [] };

function deriveTargetKey(targetInput: string): string {
  const trimmed = targetInput.trim();
  if (!trimmed) return "source:pending";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return "url:invalid";
    }
  }
  return `source:${trimmed}`;
}

type UrlAuditResponse = {
  script: AuditScript;
  nodes: Array<{
    id: string;
    label: string;
    kind: ScreenNodeData["kind"];
    position: { x: number; y: number };
    hasScreenshot: boolean;
    url: string;
    deviceType?: "mobile" | "desktop";
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
  const [nodes, setNodes] = useState<Node<ScreenNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [history, setHistory] = useState<AuditRunResult[]>([]);
  const [findingsByNode, setFindingsByNode] = useState<
    Record<string, AuditFinding[]>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");

  const noraAnchorRef = useRef<HTMLDivElement | null>(null);
  const [noraOrigin, setNoraOrigin] = useState<{ x: number; y: number } | null>(
    null
  );

  const run = useAuditRun(EMPTY_SCRIPT);

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

  const runDiffs = useCallback(
    async (tk: string, items: Array<{ nodeId: string; screenshotUrl: string | null }>) => {
      for (const { nodeId, screenshotUrl } of items) {
        if (!screenshotUrl) continue;
        const baseline = getBaseline(tk, nodeId);
        if (!baseline) continue;
        try {
          const res = await fetch("/api/diff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ baseline: baseline.dataUrl, current: screenshotUrl }),
          });
          if (!res.ok) continue;
          const data = await res.json() as {
            percentChanged: number; changedPixels: number; totalPixels: number; diffDataUrl: string;
          };
          saveRegression(tk, nodeId, {
            percentChanged: data.percentChanged,
            changedPixels: data.changedPixels,
            totalPixels: data.totalPixels,
            diffDataUrl: data.diffDataUrl,
            baselineSavedAt: baseline.savedAt,
            checkedAt: Date.now(),
          });
        } catch {
          // non-blocking — skip failed diffs
        }
      }
    },
    []
  );

  const [hasScreenshots, setHasScreenshots] = useState(false);

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
        nodeUrl: n.url,
        deviceType: n.deviceType,
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
    setHasScreenshots(res.nodes.some((n) => !!res.screenshots[n.id]));
  }, []);

  const handleStart = useCallback(async () => {
    const trimmed = targetInput.trim();

    if (!trimmed) {
      run.fail("No target specified.");
      return;
    }

    const isUrl = /^https?:\/\//i.test(trimmed);

    if (isUrl) {
      run.prepare(`Crawling ${truncate(trimmed, 40)}.`);
      try {
        const res = await fetch("/api/audit/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed, maxPages: 6 }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as UrlAuditResponse;
        swapToDynamic(data);
        const tk = deriveTargetKey(trimmed);
        const diffItems = data.nodes.map((n) => ({ nodeId: n.id, screenshotUrl: data.screenshots[n.id] ?? null }));
        setTimeout(() => runDiffs(tk, diffItems), 100);
        setTimeout(() => run.start(data.script), 50);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        run.fail(`Crawl failed. ${msg}`);
      }
      return;
    }

    // Source path / .app bundle
    run.prepare(`Reading ${truncate(trimmed, 40)}.`);
    try {
      const res = await fetch("/api/audit/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as UrlAuditResponse;
      swapToDynamic(data);
      setTimeout(() => run.start(data.script), 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      run.fail(msg);
    }
  }, [run, runDiffs, swapToDynamic, targetInput]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
    [selectedNodeId, nodes]
  );

  const targetKey = useMemo(
    () => deriveTargetKey(targetInput),
    [targetInput]
  );
  const testCaseCounts = useTestCaseCounts(targetKey);
  const scriptSummaries = useScriptSummaries(targetKey);
  const qaHistory = useQAHistory(targetKey);
  const [qaRunId, setQaRunId] = useState<string | null>(null);
  const { model, setModel } = useAIModel();
  const regressions = useRegressions(targetKey);

  const totalCaseCount = useMemo(
    () => Object.values(testCaseCounts).reduce((a, b) => a + b, 0),
    [testCaseCounts]
  );

  const nodeMetas = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: n.data.label })),
    [nodes]
  );

  const targetLabel = useMemo(() => {
    const trimmed = targetInput.trim();
    if (!trimmed) return "No target";
    return targetKey.replace(/^https?:\/\//, "");
  }, [targetInput, targetKey]);

  const handleStartQA = useCallback(() => {
    const seeded = buildStartRunResults(targetKey, nodeMetas);
    if (seeded.length === 0) return;
    const qaRun = startRun(targetKey, seeded);
    setQaRunId(qaRun.id);
  }, [targetKey, nodeMetas]);

  const handleResumeQA = useCallback((id: string) => {
    setQaRunId(id);
  }, []);

  const handleSetBaseline = useCallback(() => {
    setNodes((prev) => {
      for (const n of prev) {
        if (n.data.screenshotUrl) saveBaseline(targetKey, n.id, n.data.screenshotUrl);
      }
      return prev;
    });
  }, [targetKey]);

  const handleClearBaseline = useCallback(() => {
    clearBaselines(targetKey);
    clearRegressions(targetKey);
  }, [targetKey]);

  const activeQARun = useMemo(
    () => (qaRunId ? qaHistory.find((r) => r.id === qaRunId) ?? null : null),
    [qaRunId, qaHistory]
  );

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const tcCount = testCaseCounts[n.id] ?? 0;
        const summary = scriptSummaries[n.id];
        const regressionPct = regressions[n.id]?.percentChanged ?? null;
        const same =
          n.data.testCaseCount === tcCount &&
          shallowEqualSummary(n.data.scriptSummary, summary) &&
          n.data.regressionPct === regressionPct;
        if (same) return n;
        return {
          ...n,
          data: {
            ...n.data,
            testCaseCount: tcCount,
            scriptSummary: summary,
            regressionPct,
          },
        };
      })
    );
  }, [testCaseCounts, scriptSummaries, regressions]);

  // Suppress resetCanvas warning — only needed if nodes exist
  void resetCanvas;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#08080a] text-zinc-100">
      <Topbar
        running={run.running}
        targetInput={targetInput}
        model={model}
        onTargetChange={setTargetInput}
        onModelChange={setModel}
        onStart={handleStart}
        onStop={run.stop}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          running={run.running}
          progress={run.progress}
          history={history}
          qaRuns={qaHistory}
          qaCaseCount={totalCaseCount}
          targetKey={targetKey}
          hasScreenshots={hasScreenshots}
          onStartQA={handleStartQA}
          onResumeQA={handleResumeQA}
          onSetBaseline={handleSetBaseline}
          onClearBaseline={handleClearBaseline}
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
            model={model}
            onClose={() => setSelectedNodeId(null)}
          />
        </main>
      </div>

      <QARunModal
        open={!!qaRunId && !!activeQARun}
        run={activeQARun}
        targetKey={targetKey}
        targetLabel={targetLabel}
        nodes={nodeMetas}
        onClose={() => setQaRunId(null)}
      />
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function shallowEqualSummary(
  a: ScreenNodeData["scriptSummary"],
  b: ScreenNodeData["scriptSummary"]
) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.pass === b.pass &&
    a.fail === b.fail &&
    a.error === b.error &&
    a.total === b.total
  );
}
