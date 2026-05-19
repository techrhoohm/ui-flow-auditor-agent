"use client";

import { useCallback, useEffect, useState } from "react";

export type QAStatus = "pending" | "pass" | "fail" | "blocked" | "skipped";

export type QAResult = {
  testCaseId: string;
  nodeId: string;
  status: QAStatus;
  notes: string;
  evaluatedAt: number | null;
};

export type QARun = {
  id: string;
  targetKey: string;
  startedAt: number;
  completedAt: number | null;
  results: QAResult[];
};

const STORAGE_KEY = "uifa:qa-runs:v1";
const EVENT = "uifa:qa-runs:changed";

type Store = Record<string, QARun[]>; // targetKey -> runs (newest first)

const isBrowser = () => typeof window !== "undefined";

function read(): Store {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore
  }
}

const newId = () =>
  `qa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function listRuns(targetKey: string): QARun[] {
  return read()[targetKey] ?? [];
}

export function getRun(targetKey: string, id: string): QARun | null {
  const runs = listRuns(targetKey);
  return runs.find((r) => r.id === id) ?? null;
}

export function startRun(
  targetKey: string,
  results: Omit<QAResult, "evaluatedAt" | "notes" | "status">[]
): QARun {
  const run: QARun = {
    id: newId(),
    targetKey,
    startedAt: Date.now(),
    completedAt: null,
    results: results.map((r) => ({
      ...r,
      status: "pending",
      notes: "",
      evaluatedAt: null,
    })),
  };
  const store = read();
  const list = store[targetKey] ?? [];
  store[targetKey] = [run, ...list].slice(0, 20);
  write(store);
  return run;
}

export function patchRun(
  targetKey: string,
  runId: string,
  patch: Partial<QARun>
): QARun | null {
  const store = read();
  const list = store[targetKey] ?? [];
  const idx = list.findIndex((r) => r.id === runId);
  if (idx === -1) return null;
  const next = { ...list[idx], ...patch };
  list[idx] = next;
  store[targetKey] = list;
  write(store);
  return next;
}

export function setResult(
  targetKey: string,
  runId: string,
  testCaseId: string,
  status: QAStatus,
  notes?: string
): QARun | null {
  const store = read();
  const list = store[targetKey] ?? [];
  const idx = list.findIndex((r) => r.id === runId);
  if (idx === -1) return null;
  const run = list[idx];
  const nextResults = run.results.map((r) =>
    r.testCaseId === testCaseId
      ? {
          ...r,
          status,
          notes: notes ?? r.notes,
          evaluatedAt: Date.now(),
        }
      : r
  );
  const updated: QARun = { ...run, results: nextResults };
  list[idx] = updated;
  store[targetKey] = list;
  write(store);
  return updated;
}

export function finishRun(targetKey: string, runId: string): QARun | null {
  return patchRun(targetKey, runId, { completedAt: Date.now() });
}

export function deleteRun(targetKey: string, runId: string) {
  const store = read();
  store[targetKey] = (store[targetKey] ?? []).filter((r) => r.id !== runId);
  write(store);
}

export function summarize(run: QARun) {
  const c = { pending: 0, pass: 0, fail: 0, blocked: 0, skipped: 0 };
  for (const r of run.results) c[r.status]++;
  const total = run.results.length;
  const evaluated = total - c.pending;
  return { ...c, total, evaluated };
}

export function useQAHistory(targetKey: string | null) {
  const [runs, setRuns] = useState<QARun[]>([]);
  const refresh = useCallback(() => {
    if (!targetKey) {
      setRuns([]);
      return;
    }
    setRuns(listRuns(targetKey));
  }, [targetKey]);

  useEffect(() => {
    refresh();
    if (!isBrowser()) return;
    const onChange = () => refresh();
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return runs;
}

export function useQARun(targetKey: string | null, runId: string | null) {
  const [run, setRun] = useState<QARun | null>(null);
  const refresh = useCallback(() => {
    if (!targetKey || !runId) {
      setRun(null);
      return;
    }
    setRun(getRun(targetKey, runId));
  }, [targetKey, runId]);

  useEffect(() => {
    refresh();
    if (!isBrowser()) return;
    const onChange = () => refresh();
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [refresh]);

  return run;
}
