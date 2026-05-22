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
  onTargetChange: (value: string) => void;
  onModelChange: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
  onExport: () => void;
  onAgent: () => void;
};

const COLOR_CLASSES: Record<string, { badge: string; text: string }> = {
  violet: { badge: "border-violet-400/40 bg-violet-500/10", text: "text-violet-300" },
  sky: { badge: "border-sky-400/40 bg-sky-500/10", text: "text-sky-300" },
  teal: { badge: "border-teal-400/40 bg-teal-500/10", text: "text-teal-300" },
  emerald: { badge: "border-emerald-400/40 bg-emerald-500/10", text: "text-emerald-300" },
  cyan: { badge: "border-cyan-400/40 bg-cyan-500/10", text: "text-cyan-300" },
  zinc: { badge: "border-zinc-600/60 bg-zinc-800/50", text: "text-zinc-400" },
};

function PlatformBadge({ input }: { input: string }) {
  const platform = detectPlatform(input || "");
  const colors = COLOR_CLASSES[platform.color] ?? COLOR_CLASSES.zinc;

  return (
    <div
      className={`flex h-[30px] w-14 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${colors.badge} ${colors.text}`}
      title={`Detected: ${platform.label}`}
    >
      {platform.label}
    </div>
  );
}

export function Topbar({
  running,
  targetInput,
  model,
  hasNodes,
  agentActive,
  onTargetChange,
  onModelChange,
  onStart,
  onStop,
  onExport,
  onAgent,
}: Props) {
  const [local, setLocal] = useState(targetInput);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TargetHistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external changes in
  useEffect(() => setLocal(targetInput), [targetInput]);

  // Load history when dropdown opens
  useEffect(() => {
    if (historyOpen) {
      setHistory(getHistory());
    }
  }, [historyOpen]);

  // Close dropdown on outside click
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

  const commit = () => {
    const trimmed = local.trim();
    onTargetChange(trimmed);
  };

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // webkitRelativePath gives us "folderName/file.ext" — extract the root folder name
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
    const folderName = rel.split("/")[0] ?? file.name;
    const newVal = `~/${folderName}`;
    setLocal(newVal);
    onTargetChange(newVal);
    // reset so the same folder can be picked again
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
  const showLocalOnlyBanner = isRemote && (platform.kind === "macos" || platform.kind === "ios" || platform.kind === "android" || platform.kind === "flutter" || platform.kind === "reactnative");

  return (
    <div className="shrink-0">
    <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-4 backdrop-blur">
      {/* Left — brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-400/40 bg-violet-500/10 font-mono text-[11px] text-violet-300">
          N
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-medium text-zinc-100">
            UI Flow Auditor
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            Milestone 17 · Agent
          </span>
        </div>
      </div>

      {/* Center — smart target bar */}
      <div className="flex flex-1 items-center gap-2 px-6">
        <PlatformBadge input={local} />

        {/* Main input */}
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
          placeholder="Paste a URL or drop an app folder path…"
          className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none disabled:opacity-50"
        />

        {/* Folder picker */}
        <button
          type="button"
          disabled={running}
          onClick={() => fileInputRef.current?.click()}
          title="Pick a local app folder"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:enabled:border-zinc-600 hover:enabled:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path d="M2 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          // @ts-expect-error — webkitdirectory is a non-standard but widely supported attribute
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={handleFolderPick}
        />

        {/* Recent targets dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            disabled={running}
            onClick={() => setHistoryOpen((o) => !o)}
            title="Recent targets"
            className="flex h-7 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-medium text-zinc-400 transition-colors hover:enabled:border-zinc-600 hover:enabled:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Recent
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3 w-3"
            >
              <path
                fillRule="evenodd"
                d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {historyOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[260px] rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
              {history.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-zinc-500">No recent targets.</p>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.input}
                    type="button"
                    onClick={() => handleHistorySelect(entry)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800/60"
                  >
                    <span className="shrink-0 rounded border border-zinc-700 px-1 py-0.5 font-mono text-[9px] uppercase text-zinc-500">
                      {detectPlatform(entry.input).label}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">
                      {entry.input}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right — model + run controls */}
      <div className="flex items-center gap-3">
        {/* Agent button */}
        <button
          type="button"
          onClick={onAgent}
          title="Autonomous Agent"
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
            agentActive
              ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-200"
          }`}
        >
          {agentActive && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
            </span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clipRule="evenodd" />
          </svg>
          Agent
        </button>

        <ModelPicker model={model} onChange={onModelChange} />

        <button
          type="button"
          disabled={!hasNodes}
          onClick={onExport}
          title="Export & Share"
          className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:enabled:border-violet-400/40 hover:enabled:bg-violet-500/10 hover:enabled:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
            <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
          </svg>
          Export
        </button>

        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[12px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
            </span>
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="rounded-md border border-violet-500 bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:enabled:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start audit
          </button>
        )}
      </div>
    </header>
    {showLocalOnlyBanner && (
      <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0 text-amber-400">
          <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
        <span className="text-[11px] text-amber-300">
          <span className="font-semibold">{platform.label} auditing requires a local server.</span>
          {" "}Run <code className="rounded bg-amber-500/10 px-1 font-mono text-amber-200">npm run dev</code> in the <code className="rounded bg-amber-500/10 px-1 font-mono text-amber-200">platform/</code> folder and open <code className="rounded bg-amber-500/10 px-1 font-mono text-amber-200">http://localhost:3000</code>.
        </span>
      </div>
    )}
    </div>
  );
}
