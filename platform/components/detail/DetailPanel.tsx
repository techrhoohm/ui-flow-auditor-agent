"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Severity } from "@/lib/audit-script";
import type { AuditFinding } from "@/lib/audit-runner";
import type { ScreenNodeData } from "@/lib/fixtures";
import { MockScreen } from "@/lib/mock-screens";
import { useTestCases } from "@/lib/test-cases";
import { useScripts } from "@/lib/test-scripts";
import { ScriptsTab } from "./ScriptsTab";
import { TestCasesTab } from "./TestCasesTab";

type Tab = "findings" | "tests" | "scripts" | "timeline";

type Props = {
  nodeId: string | null;
  data: ScreenNodeData | null;
  findings: AuditFinding[];
  targetKey: string;
  model: string;
  onClose: () => void;
};

const severityOrder: Severity[] = ["high", "medium", "low"];

const kindLabel: Record<ScreenNodeData["kind"], string> = {
  entry: "Entry",
  tab: "Tab",
  modal: "Modal",
  detail: "Detail",
};

const SEV = {
  high:   { color: "var(--sev-high)", bg: "color-mix(in oklab, var(--sev-high) 10%, transparent)", border: "color-mix(in oklab, var(--sev-high) 25%, transparent)" },
  medium: { color: "var(--sev-high)", bg: "color-mix(in oklab, var(--sev-high) 10%, transparent)", border: "color-mix(in oklab, var(--sev-high) 25%, transparent)" },
  low:    { color: "var(--sev-low)",  bg: "color-mix(in oklab, var(--sev-low)  10%, transparent)", border: "color-mix(in oklab, var(--sev-low)  25%, transparent)" },
};
const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

export function DetailPanel({ nodeId, data, findings, targetKey, model, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("findings");
  const [sevFilter, setSevFilter] = useState<"all" | Severity>("all");

  const testCases = useTestCases(targetKey, nodeId);
  const scripts = useScripts(targetKey, nodeId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { setTab("findings"); setSevFilter("all"); }, [nodeId]);

  if (!nodeId || !data) return null;

  const sevCounts = { high: 0, medium: 0, low: 0 } as Record<Severity, number>;
  findings.forEach((f) => sevCounts[f.severity]++);

  const visible = sevFilter === "all" ? findings : findings.filter((f) => f.severity === sevFilter);

  return (
    <motion.aside
      key={nodeId}
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      style={{
        width: 380, flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: "var(--bg-elev)",
        borderLeft: "1px solid var(--border)",
        overflowY: "auto",
        position: "relative",
        height: "100%",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "18px 20px 14px",
        borderBottom: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 4,
        position: "relative",
      }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 14, right: 14,
            border: 0, background: "none", cursor: "pointer",
            color: "var(--fg-faint)", width: 28, height: 28,
            borderRadius: 6, display: "grid", placeItems: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunk)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "none";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-faint)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <div style={{
          fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
          textTransform: "uppercase", letterSpacing: "0.1em",
          color: "var(--fg-faint)", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            padding: "1px 6px", borderRadius: 4,
            background: "var(--chip-bg)", border: "1px solid var(--border)",
            color: "var(--fg-muted)",
          }}>
            {kindLabel[data.kind]}
          </span>
          {data.nodeUrl && (
            <span style={{ color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(() => { try { return new URL(data.nodeUrl).pathname; } catch { return data.nodeUrl; } })()}
            </span>
          )}
        </div>

        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--fg)" }}>
          {data.label}
        </div>

        {data.nodeUrl && (
          <div style={{
            fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11,
            color: "var(--fg-muted)", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2,
          }}>
            {data.nodeUrl}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", padding: "0 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elev)",
        flexShrink: 0,
      }}>
        {([
          { id: "findings" as Tab, label: "Findings", count: findings.length },
          { id: "tests"    as Tab, label: "Test cases", count: testCases.length },
          { id: "scripts"  as Tab, label: "Scripts", count: scripts.length },
          { id: "timeline" as Tab, label: "Timeline", count: undefined },
        ] as { id: Tab; label: string; count?: number }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              border: 0, background: "none", cursor: "pointer",
              padding: "12px 0", marginRight: 20,
              color: tab === t.id ? "var(--fg)" : "var(--fg-muted)",
              font: "inherit", fontSize: 12.5, fontWeight: 500,
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              display: "inline-flex", alignItems: "center", gap: 6,
              transition: "color .12s", whiteSpace: "nowrap",
            }}
          >
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span style={{
                fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10.5,
                background: tab === t.id ? "var(--accent-soft)" : "var(--chip-bg)",
                color: tab === t.id ? "var(--accent)" : "var(--fg-muted)",
                padding: "1px 6px", borderRadius: 999, fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
        {tab === "findings" && (
          <FindingsTab
            nodeId={nodeId}
            data={data}
            findings={findings}
            visible={visible}
            sevCounts={sevCounts}
            sevFilter={sevFilter}
            onSevFilter={setSevFilter}
            nodeLabel={data.label}
            model={model}
          />
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
        {tab === "timeline" && <TimelinePlaceholder findings={findings} />}
      </div>
    </motion.aside>
  );
}

function FindingsTab({
  nodeId, data, findings, visible, sevCounts, sevFilter, onSevFilter, nodeLabel, model,
}: {
  nodeId: string;
  data: ScreenNodeData;
  findings: AuditFinding[];
  visible: AuditFinding[];
  sevCounts: Record<Severity, number>;
  sevFilter: "all" | Severity;
  onSevFilter: (f: "all" | Severity) => void;
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
      const json = await res.json() as { explanation?: string; error?: string };
      setExplanations((prev) => ({ ...prev, [key]: json.explanation ?? json.error ?? "No explanation." }));
    } catch {
      setExplanations((prev) => ({ ...prev, [key]: "Request failed." }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <>
      {/* Preview card */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: 12,
        background: "var(--bg-sunk)", overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 12px", borderBottom: "1px solid var(--border)",
          background: "var(--bg-elev)",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0,1,2].map((i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: 999, background: "var(--border-strong)" }} />
            ))}
          </div>
          <span style={{
            flex: 1, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10.5,
            color: "var(--fg-faint)", background: "var(--bg-sunk)",
            borderRadius: 4, padding: "2px 6px", marginLeft: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {data.nodeUrl ?? data.label}
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          background: data.screenshotUrl ? "#FFFFFF" : "var(--bg-sunk)",
          minHeight: 200, maxHeight: 300, overflow: "hidden",
        }}>
          {data.screenshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.screenshotUrl} alt={data.label} style={{ width: "100%", objectFit: "contain" }} />
          ) : (
            <div style={{ width: 156, height: 200 }}>
              <MockScreen screenId={nodeId} />
            </div>
          )}
        </div>
      </div>

      {/* Severity grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
        {(["high", "medium", "low"] as Severity[]).map((sev) => {
          const s = SEV[sev];
          return (
            <div key={sev} style={{
              borderRadius: 8, border: `1px solid ${s.border}`,
              background: s.bg, padding: "8px 12px",
            }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase", letterSpacing: "0.06em", color: s.color, fontWeight: 600 }}>
                {SEV_LABEL[sev]}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: s.color, letterSpacing: "-0.02em", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
                {sevCounts[sev]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
        {([
          { k: "all" as const,      l: "All",    n: findings.length },
          { k: "high" as Severity,   l: "High",   n: sevCounts.high },
          { k: "medium" as Severity, l: "Medium", n: sevCounts.medium },
          { k: "low" as Severity,    l: "Low",    n: sevCounts.low },
        ]).map((c) => {
          const on = sevFilter === c.k;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => onSevFilter(c.k)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 26, padding: "0 10px", borderRadius: 999,
                border: on ? "1px solid var(--accent-ring)" : "1px solid var(--border)",
                background: on ? "var(--accent-soft)" : "var(--bg-sunk)",
                color: on ? "var(--accent)" : "var(--fg-muted)",
                fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {c.l}
              <span style={{
                fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
                fontVariantNumeric: "tabular-nums",
              }}>
                {c.n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Findings list */}
      <div style={{ marginTop: 14 }}>
        {visible.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>No findings on this screen yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {severityOrder.flatMap((sev) =>
              visible.filter((f) => f.severity === sev).map((f, i) => {
                const s = SEV[sev];
                const key = `${sev}-${i}-${f.at}`;
                const explanation = explanations[key];
                const isLoading = loading[key];
                return (
                  <div key={key} style={{
                    borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg-sunk)", padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, fontWeight: 600,
                          padding: "2px 7px", borderRadius: 999, lineHeight: 1,
                          color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: 999, background: s.color, display: "inline-block" }} />
                          {SEV_LABEL[sev]}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, color: "var(--fg-faint)", fontVariantNumeric: "tabular-nums" }}>
                          {new Date(f.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {!explanation && (
                          <button
                            type="button"
                            onClick={() => explain(key, f.message, sev)}
                            disabled={isLoading}
                            style={{
                              border: 0, background: "none", cursor: isLoading ? "wait" : "pointer",
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 10.5, fontWeight: 500, color: "var(--accent)",
                              opacity: isLoading ? 0.5 : 1, fontFamily: "inherit",
                              padding: "3px 8px", borderRadius: 6,
                              outline: "1px solid var(--accent-ring)",
                            }}
                          >
                            ✦ {isLoading ? "Asking…" : "Explain"}
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: "var(--fg)", margin: "8px 0 0" }}>
                      {f.message}
                    </p>

                    {explanation && (
                      <div style={{
                        marginTop: 10, borderRadius: 8,
                        border: "1px solid var(--accent-ring)",
                        background: "var(--accent-soft)",
                        padding: "8px 12px",
                      }}>
                        <div style={{ fontSize: 9, fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 4, fontWeight: 600 }}>
                          Nora
                        </div>
                        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--fg-muted)", margin: 0, whiteSpace: "pre-line" }}>
                          {explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TimelinePlaceholder({ findings }: { findings: AuditFinding[] }) {
  const events = [...findings]
    .sort((a, b) => b.at - a.at)
    .slice(0, 12)
    .map((f) => ({
      t: new Date(f.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      sev: f.severity,
      msg: f.message.slice(0, 60) + (f.message.length > 60 ? "…" : ""),
    }));

  if (events.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>No events yet</div>
        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>Run an audit to populate the timeline.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {events.map((e, i) => {
        const s = SEV[e.sev as Severity] ?? SEV.low;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, color: "var(--fg-faint)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {e.t}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, fontWeight: 600,
              padding: "1px 6px", borderRadius: 999, lineHeight: 1, flexShrink: 0,
              color: s.color, background: s.bg, border: `1px solid ${s.border}`,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: s.color, display: "inline-block" }} />
              {e.sev}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e.msg}
            </span>
          </div>
        );
      })}
    </div>
  );
}
