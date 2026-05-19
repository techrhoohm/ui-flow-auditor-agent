import type { QARun, QAStatus } from "./qa-runs";
import type { TestCase } from "./test-cases";
import { summarize } from "./qa-runs";

const STATUS_BADGE: Record<QAStatus, string> = {
  pending: "⏳",
  pass: "✅",
  fail: "❌",
  blocked: "🚧",
  skipped: "⏭",
};

const STATUS_WORD: Record<QAStatus, string> = {
  pending: "PENDING",
  pass: "PASS",
  fail: "FAIL",
  blocked: "BLOCKED",
  skipped: "SKIP",
};

export type RenderInput = {
  run: QARun;
  targetLabel: string;
  // testCaseId -> { case, nodeLabel }
  byCase: Record<string, { case: TestCase; nodeLabel: string }>;
};

export function renderRunMarkdown(input: RenderInput): string {
  const { run, targetLabel, byCase } = input;
  const s = summarize(run);
  const started = new Date(run.startedAt);

  const lines: string[] = [];
  lines.push(`# QA Run — ${targetLabel}`);
  lines.push("");
  lines.push(`- **Started:** ${started.toLocaleString()}`);
  if (run.completedAt) {
    lines.push(`- **Finished:** ${new Date(run.completedAt).toLocaleString()}`);
  } else {
    lines.push(`- **Finished:** (in progress)`);
  }
  lines.push(
    `- **Totals:** ${s.evaluated}/${s.total} evaluated · ${s.pass} pass · ${s.fail} fail · ${s.blocked} blocked · ${s.skipped} skipped`
  );
  lines.push("");

  // Group results by nodeLabel
  const byNode = new Map<string, typeof run.results>();
  for (const r of run.results) {
    const meta = byCase[r.testCaseId];
    const nodeLabel = meta?.nodeLabel ?? r.nodeId;
    const list = byNode.get(nodeLabel) ?? [];
    list.push(r);
    byNode.set(nodeLabel, list);
  }

  for (const [nodeLabel, results] of byNode) {
    lines.push(`## ${nodeLabel}`);
    lines.push("");
    for (const r of results) {
      const meta = byCase[r.testCaseId];
      const title = meta?.case.title ?? `(missing case ${r.testCaseId})`;
      lines.push(
        `### ${STATUS_BADGE[r.status]} [${STATUS_WORD[r.status]}] ${title}`
      );
      if (meta?.case.body?.trim()) {
        lines.push("");
        lines.push("**Steps**");
        lines.push("");
        for (const ln of meta.case.body.split("\n")) {
          lines.push(`> ${ln}`);
        }
      }
      if (r.notes.trim()) {
        lines.push("");
        lines.push("**Notes**");
        lines.push("");
        for (const ln of r.notes.split("\n")) {
          lines.push(`> ${ln}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
