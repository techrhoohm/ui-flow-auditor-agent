"use client";

import { useEffect, useRef, useState } from "react";
import { ModelPicker } from "./ModelPicker";
import { detectPlatform } from "@/lib/platform-detect";
import { addToHistory, getHistory, type TargetHistoryEntry } from "@/lib/target-history";

function useIsRemote() {
  const [isRemote, setIsRemote] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    setIsRemote(h !== "localhost" && h !== "127.0.0.1" && h !== "::1");
  }, []);
  return isRemote;
}

type Props = {
  running: boolean;
  targetInput: string;
  model: string;
  hasNodes: boolean;
  agentActive: boolean;
  theme: "dark" | "light";
  onTargetChange: (value: string) => void;
  onModelChange: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
  onExport: () => void;
  onAgent: () => void;
  onThemeChange: (theme: "dark" | "light") => void;
};

export function Topbar({
  running,
  targetInput,
  model,
  hasNodes,
  agentActive,
  theme,
  onTargetChange,
  onModelChange,
  onStart,
  onStop,
  onExport,
  onAgent,
  onThemeChange,
}: Props) {
  const [local, setLocal] = useState(targetInput);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TargetHistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLocal(targetInput), [targetInput]);

  useEffect(() => {
    if (historyOpen) setHistory(getHistory());
  }, [historyOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [historyOpen]);

  const commit = () => onTargetChange(local.trim());

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
    const folderName = rel.split("/")[0] ?? file.name;
    const newVal = `~/${folderName}`;
    setLocal(newVal);
    onTargetChange(newVal);
    e.target.value = "";
  };

  const handleHistorySelect = (entry: TargetHistoryEntry) => {
    setLocal(entry.input);
    onTargetChange(entry.input);
    setHistoryOpen(false);
  };

  const handleStart = () => {
    const trimmed = local.trim();
    if (trimmed) {
      const platform = detectPlatform(trimmed);
      addToHistory(trimmed, platform.label);
    }
    onStart();
  };

  const canStart = local.trim().length > 0;
  const isRemote = useIsRemote();
  const platform = detectPlatform(local);
  const showLocalOnlyBanner = isRemote && (
    platform.kind === "macos" || platform.kind === "ios" ||
    platform.kind === "android" || platform.kind === "flutter" ||
    platform.kind === "reactnative"
  );

  return (
    <div className="shrink-0">
      <header
        className="grid items-center gap-4 px-4"
        style={{
          gridTemplateColumns: "280px 1fr auto",
          height: 56,
          background: "var(--bg-elev)",
          borderBottom: "1px solid var(--border)",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 28, height: 28,
              borderRadius: 7,
              background: "linear-gradient(135deg, var(--accent) 0%, #8A82FF 100%)",
              display: "grid", placeItems: "center",
              color: "white", fontWeight: 600, fontSize: 12,
              boxShadow: "0 1px 0 #ffffff30 inset, 0 6px 14px -4px #635BFF55",
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            UX
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--fg)" }}>
              UX Auditor
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 1 }}>
              Workspace · Primitive
            </div>
          </div>
        </div>

        {/* Center — URL bar */}
        <div className="flex items-center gap-2 mx-auto w-full max-w-[860px]">
          {/* Platform pill */}
          <div
            className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-widest"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "1px solid var(--accent-ring)",
              padding: "5px 10px",
              borderRadius: 999,
            }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>
            </svg>
            {platform.label}
          </div>

          {/* URL input */}
          <label
            className="flex flex-1 items-center gap-2 px-3"
            style={{
              height: 34,
              background: "var(--bg-sunk)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              transition: "border-color .15s, box-shadow .15s",
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fg-faint)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commit();
                  if (!running && canStart) handleStart();
                }
              }}
              disabled={running}
              placeholder="https://example.com  ·  paste URL or path"
              style={{
                border: 0, background: "none", outline: "none",
                flex: 1, color: "var(--fg)",
                fontFamily: "var(--font-mono)", fontSize: 12,
                letterSpacing: "-0.01em",
              }}
              spellCheck={false}
            />
            <kbd style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              padding: "1px 5px",
              border: "1px solid var(--border)", borderBottomWidth: 2,
              borderRadius: 4,
              color: "var(--fg-muted)",
              background: "var(--bg-elev)",
            }}>⌘ K</kbd>
          </label>

          {/* Folder picker */}
          <button
            type="button"
            disabled={running}
            onClick={() => fileInputRef.current?.click()}
            title="Pick a local app folder"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              height: 32, width: 32,
              border: "1px solid var(--border)",
              background: "var(--bg-elev)",
              color: "var(--fg-muted)",
              borderRadius: 7, cursor: "pointer",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory="" multiple className="hidden"
            onChange={handleFolderPick}
          />

          {/* Recent dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              disabled={running}
              onClick={() => setHistoryOpen((o) => !o)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 32, padding: "0 10px",
                border: "1px solid var(--border)",
                background: "var(--bg-elev)",
                color: "var(--fg)",
                borderRadius: 7, cursor: "pointer",
                fontSize: 12.5, fontWeight: 500,
              }}
            >
              Recent
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {historyOpen && (
              <div
                className="absolute left-0 top-full mt-1 min-w-[260px] py-1"
                style={{
                  zIndex: 50,
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {history.length === 0 ? (
                  <p className="px-3 py-2" style={{ fontSize: 11, color: "var(--fg-faint)" }}>No recent targets.</p>
                ) : (
                  history.map((entry) => (
                    <button key={entry.input} type="button" onClick={() => handleHistorySelect(entry)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
                      style={{ color: "var(--fg)", fontSize: 12 }}
                    >
                      <span style={{
                        fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase",
                        border: "1px solid var(--border)", borderRadius: 4,
                        padding: "1px 4px", color: "var(--fg-faint)",
                      }}>
                        {detectPlatform(entry.input).label}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{entry.input}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Theme switch */}
          <div
            className="flex items-center p-0.5"
            style={{
              background: "var(--bg-sunk)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              height: 30,
            }}
          >
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onThemeChange(t)}
                style={{
                  border: 0,
                  background: theme === t ? "var(--bg-elev)" : "none",
                  color: theme === t ? "var(--fg)" : "var(--fg-muted)",
                  width: 26, height: 26,
                  borderRadius: 999,
                  display: "grid", placeItems: "center",
                  cursor: "pointer",
                  transition: "background .12s, color .12s",
                  boxShadow: theme === t ? "var(--shadow-sm)" : "none",
                }}
                aria-label={t === "light" ? "Light theme" : "Dark theme"}
              >
                {t === "light" ? (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
                  </svg>
                ) : (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Agent */}
          <button
            type="button"
            onClick={onAgent}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 32, padding: "0 12px",
              borderRadius: 7,
              border: agentActive ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: agentActive ? "var(--accent-soft)" : "var(--bg-elev)",
              color: agentActive ? "var(--accent)" : "var(--fg)",
              fontSize: 12.5, fontWeight: 500, cursor: "pointer",
              transition: "background .12s, border-color .12s",
            }}
          >
            {agentActive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--accent)" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              </span>
            )}
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
            </svg>
            Agent
          </button>

          <ModelPicker model={model} onChange={onModelChange} />

          {/* Export */}
          <button
            type="button"
            disabled={!hasNodes}
            onClick={onExport}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 32, padding: "0 12px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "var(--bg-elev)",
              color: "var(--fg)",
              fontSize: 12.5, fontWeight: 500, cursor: "pointer",
              opacity: hasNodes ? 1 : 0.4,
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v12m0-12l-4 4m4-4l4 4M4 20h16"/>
            </svg>
            Export
          </button>

          {/* Start / Stop */}
          {running ? (
            <button
              type="button"
              onClick={onStop}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 32, padding: "0 12px",
                borderRadius: 7,
                border: "1px solid color-mix(in srgb, var(--sev-high) 40%, transparent)",
                background: "color-mix(in srgb, var(--sev-high) 10%, transparent)",
                color: "var(--sev-high)",
                fontSize: 12.5, fontWeight: 500, cursor: "pointer",
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--sev-high)" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--sev-high)" }} />
              </span>
              Crawling…
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 32, padding: "0 12px",
                borderRadius: 7,
                border: "1px solid var(--accent)",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 12.5, fontWeight: 500, cursor: canStart ? "pointer" : "not-allowed",
                opacity: canStart ? 1 : 0.4,
                boxShadow: "0 1px 0 #ffffff30 inset, 0 1px 0 #00000010, 0 4px 10px -2px #635BFF55",
              }}
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Start audit
            </button>
          )}
        </div>
      </header>

      {showLocalOnlyBanner && (
        <div
          className="flex items-center gap-2 px-4 py-1.5"
          style={{ borderBottom: "1px solid color-mix(in srgb, var(--sev-med) 20%, transparent)", background: "color-mix(in srgb, var(--sev-med) 5%, transparent)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0" style={{ color: "var(--sev-med)" }}>
            <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            <span style={{ fontWeight: 600, color: "var(--fg)" }}>{platform.label} auditing requires a local server.</span>
            {" "}Run <code style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, background: "var(--bg-sunk)", padding: "1px 4px", borderRadius: 3 }}>npm run dev</code> in the <code style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, background: "var(--bg-sunk)", padding: "1px 4px", borderRadius: 3 }}>platform/</code> folder.
          </span>
        </div>
      )}
    </div>
  );
}
