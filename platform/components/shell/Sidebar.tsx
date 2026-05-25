"use client";

import { useEffect, useState } from "react";
import type { AuditRunResult } from "@/lib/audit-runner";
import { summarize, type QARun } from "@/lib/qa-runs";
import { getBaselineMeta, BASELINES_EVENT, type BaselineMeta } from "@/lib/baselines";

type Props = {
  running: boolean;
  progress: { index: number; total: number };
  history: AuditRunResult[];
  qaRuns: QARun[];
  qaCaseCount: number;
  targetKey: string;
  hasScreenshots: boolean;
  crawlStats: { pages: number; depth: number; findings: number };
  onStartQA: () => void;
  onResumeQA: (id: string) => void;
  onSetBaseline: () => void;
  onClearBaseline: () => void;
  onRestoreSession: (runId: string) => void;
};

const formatTime = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (start: number, end: number) => {
  const s = Math.max(1, Math.round((end - start) / 1000));
  return `${s}s`;
};

function hostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function groupHistoryByDate(history: AuditRunResult[]) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart.getTime() - 86400000;
  const groups: { label: string; runs: AuditRunResult[] }[] = [
    { label: "Today", runs: [] },
    { label: "Yesterday", runs: [] },
    { label: "Earlier", runs: [] },
  ];
  for (const r of history) {
    if (r.startedAt >= todayStart.getTime()) groups[0].runs.push(r);
    else if (r.startedAt >= yesterdayStart) groups[1].runs.push(r);
    else groups[2].runs.push(r);
  }
  return groups.filter((g) => g.runs.length > 0);
}

const SEV_COLORS: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  high: {
    color: "var(--sev-high)",
    bg: "color-mix(in oklab, var(--sev-high) 10%, transparent)",
    border: "color-mix(in oklab, var(--sev-high) 25%, transparent)",
    dot: "var(--sev-high)",
  },
  medium: {
    color: "var(--sev-high)",
    bg: "color-mix(in oklab, var(--sev-high) 10%, transparent)",
    border: "color-mix(in oklab, var(--sev-high) 25%, transparent)",
    dot: "var(--sev-high)",
  },
  med: {
    color: "var(--sev-med)",
    bg: "color-mix(in oklab, var(--sev-med) 10%, transparent)",
    border: "color-mix(in oklab, var(--sev-med) 25%, transparent)",
    dot: "var(--sev-med)",
  },
  low: {
    color: "var(--sev-low)",
    bg: "color-mix(in oklab, var(--sev-low) 10%, transparent)",
    border: "color-mix(in oklab, var(--sev-low) 25%, transparent)",
    dot: "var(--sev-low)",
  },
};

function SevBadge({ sev, count }: { sev: string; count: number }) {
  const key = sev === "medium" ? "high" : sev;
  const c = SEV_COLORS[key] ?? SEV_COLORS.low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, fontWeight: 600,
      padding: "2px 6px", borderRadius: 999, lineHeight: 1,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      fontVariantNumeric: "tabular-nums",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot, flexShrink: 0, display: "inline-block" }} />
      {count}
    </span>
  );
}

export function Sidebar({
  running,
  progress,
  history,
  qaRuns,
  qaCaseCount,
  targetKey,
  hasScreenshots,
  crawlStats,
  onStartQA,
  onResumeQA,
  onSetBaseline,
  onClearBaseline,
  onRestoreSession,
}: Props) {
  const pct = progress.total > 0 ? Math.round((progress.index / progress.total) * 100) : 0;
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const [baselineMeta, setBaselineMeta] = useState<BaselineMeta>({ count: 0, savedAt: null });
  useEffect(() => {
    const refresh = () => { void getBaselineMeta(targetKey).then(setBaselineMeta); };
    refresh();
    window.addEventListener(BASELINES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(BASELINES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [targetKey]);

  const grouped = groupHistoryByDate(history);

  return (
    <aside
      className="hidden sm:flex flex-col overflow-y-auto"
      style={{
        width: 280,
        background: "var(--bg-elev)",
        borderRight: "1px solid var(--border)",
        padding: "18px 0",
      }}
    >
      {/* ── Crawl stats ── */}
      <div style={{ padding: "0 18px 18px" }}>
        <div style={labelStyle}>Crawl</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { num: crawlStats.pages,    lbl: "Pages"    },
            { num: crawlStats.depth,    lbl: "Depth"    },
            { num: crawlStats.findings, lbl: "Findings" },
          ].map(({ num, lbl }) => (
            <div key={lbl} style={statCardStyle}>
              <div style={statNumStyle}>{num}</div>
              <div style={statLblStyle}>{lbl}</div>
            </div>
          ))}
        </div>

        {running && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>
              <span>Auditing…</span>
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontVariantNumeric: "tabular-nums" }}>
                {progress.index}/{progress.total}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: "var(--border-strong)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 999, transition: "width .2s" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Manual QA ── */}
      <div style={blockStyle}>
        <div style={labelStyle}>
          Manual QA
          <button
            type="button"
            onClick={onStartQA}
            disabled={qaCaseCount === 0}
            title={qaCaseCount === 0 ? "Add test cases on any node first" : `Run ${qaCaseCount} test case${qaCaseCount === 1 ? "" : "s"}`}
            style={smBtnStyle(false)}
          >
            {qaCaseCount === 0 ? "Author" : "Start"}
          </button>
        </div>
        {qaRuns.length === 0 ? (
          <p style={hintStyle}>
            {qaCaseCount === 0 ? "Add acceptance criteria the agent should verify on every audit." : "No QA runs yet."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
            {qaRuns.slice(0, 4).map((r) => {
              const s = summarize(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onResumeQA(r.id)}
                  style={{
                    width: "100%", textAlign: "left", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--bg-sunk)",
                    padding: "8px 10px", cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono, ui-monospace)" }}>
                    <span>{formatTime(r.startedAt)}</span>
                    <span style={{ color: r.completedAt ? "var(--fg-faint)" : "var(--accent)" }}>
                      {r.completedAt ? "done" : "in-progress"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono, ui-monospace)" }}>
                    <span style={{ color: "var(--sev-low)" }}>{s.pass}p</span>
                    <span style={{ color: "var(--sev-high)" }}>{s.fail}f</span>
                    <span style={{ color: "var(--sev-med)" }}>{s.blocked}b</span>
                    <span style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{s.evaluated}/{s.total}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Visual baseline ── */}
      <div style={blockStyle}>
        <div style={labelStyle}>
          Visual baseline
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {baselineMeta.count > 0 && (
              <button type="button" onClick={onClearBaseline} style={{ ...smBtnStyle(false), border: "none", background: "none", color: "var(--sev-high)" }}>
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onSetBaseline}
              disabled={!hasScreenshots || running}
              title={!hasScreenshots ? "Run a URL audit first" : "Save current screenshots as baseline"}
              style={smBtnStyle(!hasScreenshots || running)}
            >
              Set
            </button>
          </div>
        </div>
        {baselineMeta.count > 0 ? (
          <p style={{ ...hintStyle, color: "var(--fg-muted)" }}>
            {baselineMeta.count} screen{baselineMeta.count === 1 ? "" : "s"} ·{" "}
            <span style={{ color: "var(--fg-faint)" }}>
              {baselineMeta.savedAt ? new Date(baselineMeta.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </p>
        ) : (
          <p style={hintStyle}>
            {hasScreenshots ? "No baseline set. Click Set to save current screenshots." : "Compares future audits pixel-by-pixel against the saved frame."}
          </p>
        )}
      </div>

      {/* ── History ── */}
      <div style={{ ...blockStyle, flex: 1 }}>
        <div style={labelStyle}>History</div>
        {history.length === 0 ? (
          <p style={hintStyle}>No completed audits yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {grouped.map((group, gi) => (
              <div key={group.label}>
                <div style={{
                  fontFamily: "var(--font-mono, ui-monospace)",
                  fontSize: 10, color: "var(--fg-faint)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  fontWeight: 600,
                  margin: gi === 0 ? "4px 0 8px" : "14px 0 8px",
                }}>
                  {group.label}
                </div>
                {group.runs.map((r) => {
                  const targets = r.targets ?? [r.target];
                  const primary = hostname(targets[0] ?? r.target);
                  const extra = targets.length - 1;
                  const high = r.findings.filter((f) => f.severity === "high").length;
                  const medium = r.findings.filter((f) => f.severity === "medium").length;
                  const low = r.findings.filter((f) => f.severity === "low").length;
                  const isActive = activeHistoryId === r.id;
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setActiveHistoryId(r.id); onRestoreSession(r.id); }}
                      onKeyDown={(e) => e.key === "Enter" && onRestoreSession(r.id)}
                      style={{
                        display: "block", padding: "10px 12px", borderRadius: 8,
                        cursor: "pointer", border: "1px solid transparent",
                        background: isActive ? "var(--accent-soft)" : "transparent",
                        borderColor: isActive ? "var(--accent-ring)" : "transparent",
                        marginTop: 2, transition: "background .12s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLDivElement).style.background = "var(--bg-sunk)";
                          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLDivElement).style.background = "transparent";
                          (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
                        }
                      }}
                    >
                      {/* Row 1: url + extra + time */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", fontFamily: "var(--font-mono, ui-monospace)",
                          fontSize: 11.5, fontWeight: 500, color: "var(--fg)",
                        }}>
                          <span style={{ color: "var(--fg-faint)", fontWeight: 400 }}>url · </span>
                          {primary}
                        </span>
                        {extra > 0 && (
                          <span style={{
                            flexShrink: 0, fontFamily: "var(--font-mono, ui-monospace)",
                            fontSize: 9, color: "var(--fg-faint)",
                            background: "var(--bg-sunk)", border: "1px solid var(--border)",
                            borderRadius: 999, padding: "1px 6px",
                          }}>
                            +{extra} more
                          </span>
                        )}
                        <span style={{ flexShrink: 0, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, color: "var(--fg-faint)", fontVariantNumeric: "tabular-nums" }}>
                          {formatTime(r.startedAt)}
                        </span>
                      </div>
                      {/* Row 2: severity badges + duration */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                        <div style={{ display: "flex", gap: 4, flex: 1 }}>
                          {high > 0 && <SevBadge sev="high" count={high} />}
                          {medium > 0 && <SevBadge sev="high" count={medium} />}
                          {low > 0 && <SevBadge sev="low" count={low} />}
                          {r.findings.length === 0 && (
                            <span style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono, ui-monospace)" }}>no findings</span>
                          )}
                        </div>
                        <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, color: "var(--fg-faint)", fontVariantNumeric: "tabular-nums" }}>
                          {formatDuration(r.startedAt, r.endedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Avatar (Nora) ── */}
      <div style={blockStyle}>
        <div style={labelStyle}>Avatar</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #3a3a55, #0B0B14 70%)",
            position: "relative", display: "grid", placeItems: "center",
            border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)",
            flexShrink: 0,
          }}>
            <span style={{
              position: "absolute", width: 5, height: 5, borderRadius: 999,
              background: "var(--accent)", top: 14, left: 10,
              boxShadow: "0 0 6px var(--accent)",
            }} />
            <span style={{
              position: "absolute", width: 5, height: 5, borderRadius: 999,
              background: "var(--accent)", top: 14, right: 10,
              boxShadow: "0 0 6px var(--accent)",
            }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Nora</div>
            <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
              silent · detail-bound
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Style constants ── */

const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  fontFamily: "var(--font-mono, ui-monospace)",
  textTransform: "uppercase", fontSize: 10, letterSpacing: "0.08em",
  color: "var(--fg-faint)", fontWeight: 600, marginBottom: 10,
};

const blockStyle: React.CSSProperties = {
  padding: "18px 18px 18px",
  borderTop: "1px solid var(--border)",
};

const statCardStyle: React.CSSProperties = {
  background: "var(--bg-sunk)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 10px",
};

const statNumStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em",
  color: "var(--fg)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
};

const statLblStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace)", fontSize: 9.5,
  textTransform: "uppercase", letterSpacing: "0.08em",
  color: "var(--fg-faint)", fontWeight: 600, marginTop: 2,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5, margin: 0,
};

function smBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    height: 26, padding: "0 9px", borderRadius: 6,
    border: "1px solid var(--border)", background: "var(--bg-elev)",
    color: disabled ? "var(--fg-faint)" : "var(--fg)",
    fontSize: 11.5, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
  };
}
