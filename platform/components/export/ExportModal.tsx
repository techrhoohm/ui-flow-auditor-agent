"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import type { AuditFinding } from "@/lib/audit-runner";
import type { ScreenNodeData } from "@/lib/fixtures";
import { buildReport, generateReportHtml } from "@/lib/report";

type Props = {
  open: boolean;
  nodes: Node<ScreenNodeData>[];
  findingsByNode: Record<string, AuditFinding[]>;
  targetLabel: string;
  targetInput: string;
  onClose: () => void;
};

type Tab = "report" | "github" | "slack";

type GHState = { token: string; owner: string; repo: string; severity: "all" | "high" | "medium" };
type SlackState = { webhookUrl: string };
type Status = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "loading") return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] text-zinc-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-400" />
      Working…
    </div>
  );
  const isOk = status.kind === "ok";
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${isOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
      {status.msg}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

const INPUT_CLS = "rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none";
const BTN_PRIMARY = "rounded-md border border-violet-400/40 bg-violet-500/15 px-4 py-1.5 text-[12px] font-medium text-violet-200 transition-colors hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GHOST = "rounded-md border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100";

export function ExportModal({ open, nodes, findingsByNode, targetLabel, targetInput, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("report");
  const [gh, setGh] = useState<GHState>({ token: "", owner: "", repo: "", severity: "all" });
  const [slack, setSlack] = useState<SlackState>({ webhookUrl: "" });
  const [ghStatus, setGhStatus] = useState<Status>({ kind: "idle" });
  const [slackStatus, setSlackStatus] = useState<Status>({ kind: "idle" });
  const overlayRef = useRef<HTMLDivElement>(null);

  const allFindings = nodes.flatMap((n) => (findingsByNode[n.id] ?? []).map((f) => ({ ...f, nodeLabel: n.data.label })));
  const hasFindings = allFindings.length > 0;
  const hasNodes = nodes.length > 0;

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  const handlePDF = () => {
    const report = buildReport(targetLabel, targetInput, nodes, findingsByNode);
    const html = generateReportHtml(report);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.focus();
    // Revoke after a few seconds so the blob doesn't persist
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const handleDownloadHtml = () => {
    const report = buildReport(targetLabel, targetInput, nodes, findingsByNode);
    const html = generateReportHtml(report);
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${Date.now()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const filteredFindings = allFindings.filter((f) => {
    if (gh.severity === "high") return f.severity === "high";
    if (gh.severity === "medium") return f.severity === "high" || f.severity === "medium";
    return true;
  });

  const handleGitHub = async () => {
    if (!gh.token || !gh.owner || !gh.repo) return;
    setGhStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/integrations/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: gh.token,
          owner: gh.owner,
          repo: gh.repo,
          target: targetInput,
          findings: filteredFindings.map((f) => ({
            nodeId: f.nodeId,
            nodeLabel: f.nodeLabel,
            severity: f.severity,
            message: f.message,
          })),
        }),
      });
      const data = await res.json() as { created?: string[]; failed?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const msg = `${data.created?.length ?? 0} issue${data.created?.length === 1 ? "" : "s"} created${data.failed?.length ? `, ${data.failed.length} failed` : ""}.`;
      setGhStatus({ kind: "ok", msg });
    } catch (err) {
      setGhStatus({ kind: "err", msg: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleSlack = async () => {
    if (!slack.webhookUrl) return;
    setSlackStatus({ kind: "loading" });
    const report = buildReport(targetLabel, targetInput, nodes, findingsByNode);
    try {
      const res = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: slack.webhookUrl,
          title: report.title,
          target: report.target,
          totals: report.totals,
          topFindings: allFindings
            .filter((f) => f.severity === "high" || f.severity === "medium")
            .slice(0, 5)
            .map((f) => ({ nodeLabel: f.nodeLabel, severity: f.severity, message: f.message })),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSlackStatus({ kind: "ok", msg: "Posted to Slack." });
    } catch (err) {
      setSlackStatus({ kind: "err", msg: err instanceof Error ? err.message : String(err) });
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "report", label: "PDF Report" },
    { id: "github", label: "GitHub Issues" },
    { id: "slack", label: "Slack" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative flex w-[480px] flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold text-zinc-100">Export &amp; Share</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">{targetLabel}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-zinc-800 px-4 pt-3 pb-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-t-md px-3 pb-2 text-[12px] font-medium transition-colors ${
                    tab === t.id
                      ? "border-b-2 border-violet-400 text-violet-300"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="p-5">
              {tab === "report" && (
                <div className="flex flex-col gap-4">
                  <p className="text-[12px] text-zinc-400">
                    Generate a standalone HTML report with screenshots and findings. Open it in a browser and use <strong className="text-zinc-200">File → Print → Save as PDF</strong>.
                  </p>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { n: nodes.length, label: "Screens", color: "text-violet-400" },
                        { n: allFindings.filter((f) => f.severity === "high").length, label: "High", color: "text-rose-400" },
                        { n: allFindings.length, label: "Findings", color: "text-zinc-300" },
                      ].map((s) => (
                        <div key={s.label}>
                          <div className={`text-xl font-bold ${s.color}`}>{s.n}</div>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {!hasNodes && (
                    <p className="text-[11px] text-amber-400">Run an audit first to generate a report.</p>
                  )}
                  <div className="flex gap-2">
                    <button className={BTN_PRIMARY} disabled={!hasNodes} onClick={handlePDF}>
                      Open report
                    </button>
                    <button className={BTN_GHOST} disabled={!hasNodes} onClick={handleDownloadHtml}>
                      Download .html
                    </button>
                  </div>
                </div>
              )}

              {tab === "github" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[12px] text-zinc-400">
                    Creates one GitHub issue per finding. Adds severity labels automatically.
                  </p>
                  <Field label="Personal access token">
                    <input type="password" placeholder="ghp_…" value={gh.token} onChange={(e) => setGh((s) => ({ ...s, token: e.target.value }))} className={INPUT_CLS} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Owner">
                      <input placeholder="your-org" value={gh.owner} onChange={(e) => setGh((s) => ({ ...s, owner: e.target.value }))} className={INPUT_CLS} />
                    </Field>
                    <Field label="Repo">
                      <input placeholder="my-app" value={gh.repo} onChange={(e) => setGh((s) => ({ ...s, repo: e.target.value }))} className={INPUT_CLS} />
                    </Field>
                  </div>
                  <Field label="Severity threshold">
                    <select value={gh.severity} onChange={(e) => setGh((s) => ({ ...s, severity: e.target.value as GHState["severity"] }))} className={INPUT_CLS}>
                      <option value="high">High only</option>
                      <option value="medium">High + Medium</option>
                      <option value="all">All findings</option>
                    </select>
                  </Field>
                  {!hasFindings && <p className="text-[11px] text-amber-400">No findings to export.</p>}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">{filteredFindings.length} issue{filteredFindings.length === 1 ? "" : "s"} will be created</span>
                    <button
                      className={BTN_PRIMARY}
                      disabled={!gh.token || !gh.owner || !gh.repo || filteredFindings.length === 0 || ghStatus.kind === "loading"}
                      onClick={handleGitHub}
                    >
                      Create issues
                    </button>
                  </div>
                  <StatusBanner status={ghStatus} />
                </div>
              )}

              {tab === "slack" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[12px] text-zinc-400">
                    Posts a summary card to your Slack channel via an Incoming Webhook.
                  </p>
                  <Field label="Webhook URL">
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/…"
                      value={slack.webhookUrl}
                      onChange={(e) => setSlack({ webhookUrl: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <p className="text-[11px] text-zinc-500">
                    Create one at Slack → Apps → Incoming Webhooks. Token never leaves your network.
                  </p>
                  {!hasNodes && <p className="text-[11px] text-amber-400">Run an audit first.</p>}
                  <div className="mt-1 flex justify-end">
                    <button
                      className={BTN_PRIMARY}
                      disabled={!slack.webhookUrl || !hasNodes || slackStatus.kind === "loading"}
                      onClick={handleSlack}
                    >
                      Post to Slack
                    </button>
                  </div>
                  <StatusBanner status={slackStatus} />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
