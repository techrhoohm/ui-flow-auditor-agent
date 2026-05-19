import type { Node } from "@xyflow/react";
import type { AuditFinding } from "./audit-runner";
import type { ScreenNodeData } from "./fixtures";

export type ReportNode = {
  id: string;
  label: string;
  kind: ScreenNodeData["kind"];
  screenshotUrl: string | null;
  findings: AuditFinding[];
};

export type AuditReport = {
  title: string;
  target: string;
  generatedAt: number;
  nodes: ReportNode[];
  totals: {
    screens: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
};

export function buildReport(
  title: string,
  target: string,
  nodes: Node<ScreenNodeData>[],
  findingsByNode: Record<string, AuditFinding[]>
): AuditReport {
  const reportNodes: ReportNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.data.label,
    kind: n.data.kind,
    screenshotUrl: n.data.screenshotUrl ?? null,
    findings: findingsByNode[n.id] ?? [],
  }));

  const all = reportNodes.flatMap((n) => n.findings);
  return {
    title,
    target,
    generatedAt: Date.now(),
    nodes: reportNodes,
    totals: {
      screens: reportNodes.length,
      high: all.filter((f) => f.severity === "high").length,
      medium: all.filter((f) => f.severity === "medium").length,
      low: all.filter((f) => f.severity === "low").length,
      total: all.length,
    },
  };
}

const SEV_COLOR: Record<string, string> = {
  high: "#f87171",
  medium: "#fb923c",
  low: "#a3e635",
};

const SEV_BG: Record<string, string> = {
  high: "#450a0a",
  medium: "#431407",
  low: "#1a2e05",
};

export function generateReportHtml(report: AuditReport): string {
  const ts = new Date(report.generatedAt).toLocaleString();

  const nodesHtml = report.nodes
    .map((n) => {
      const findingsHtml = n.findings.length
        ? n.findings
            .map(
              (f) => `
          <div style="border-left:3px solid ${SEV_COLOR[f.severity] ?? "#888"};padding:8px 12px;margin:6px 0;background:${SEV_BG[f.severity] ?? "#111"};border-radius:4px;">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:${SEV_COLOR[f.severity] ?? "#888"};font-weight:700;">${f.severity}</span>
            <p style="margin:4px 0 0;font-size:13px;color:#e4e4e7;">${escHtml(f.message)}</p>
          </div>`
            )
            .join("")
        : `<p style="font-size:12px;color:#52525b;margin:6px 0;">No findings.</p>`;

      const imgHtml = n.screenshotUrl
        ? `<img src="${n.screenshotUrl}" style="display:block;max-width:100%;border-radius:6px;border:1px solid #27272a;margin-bottom:12px;" />`
        : `<div style="height:80px;background:#18181b;border:1px solid #27272a;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;"><span style="color:#52525b;font-size:11px;">No screenshot</span></div>`;

      return `
      <div style="break-inside:avoid;background:#09090b;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
          <span style="font-size:15px;font-weight:600;color:#f4f4f5;">${escHtml(n.label)}</span>
          <span style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">${n.kind}</span>
          ${n.findings.length ? `<span style="margin-left:auto;font-size:11px;color:#f87171;font-weight:600;">${n.findings.length} finding${n.findings.length === 1 ? "" : "s"}</span>` : ""}
        </div>
        ${imgHtml}
        ${findingsHtml}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(report.title)} — Audit Report</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background: #fff !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #09090b; color: #f4f4f5; }
    .page { max-width: 860px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #f4f4f5; }
    .sub { font-size: 12px; color: #71717a; margin: 0 0 24px; }
    .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
    .stat { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-num { font-size: 26px; font-weight: 700; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #71717a; margin-top: 2px; }
    .print-btn { display: inline-flex; align-items: center; gap: 6px; background: #7c3aed; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 13px; font-weight: 500; padding: 8px 16px; margin-bottom: 24px; }
    .print-btn:hover { background: #6d28d9; }
  </style>
</head>
<body>
<div class="page">
  <button class="print-btn no-print" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2h1a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Zm2 0h6v3H7V4Zm-1 9h8v4H6v-4Zm8-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clip-rule="evenodd"/></svg>
    Save as PDF
  </button>

  <h1>${escHtml(report.title)}</h1>
  <p class="sub">${escHtml(report.target)} &nbsp;·&nbsp; ${ts}</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-num" style="color:#a78bfa;">${report.totals.screens}</div>
      <div class="stat-label">Screens</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#f87171;">${report.totals.high}</div>
      <div class="stat-label">High</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#fb923c;">${report.totals.medium}</div>
      <div class="stat-label">Medium</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#a3e635;">${report.totals.low}</div>
      <div class="stat-label">Low</div>
    </div>
  </div>

  ${nodesHtml}

  <p style="font-size:10px;color:#3f3f46;margin-top:24px;text-align:right;">Generated by UI Flow Auditor · ${ts}</p>
</div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
