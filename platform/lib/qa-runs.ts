"use client";

import { useCallback, useEffect, useState } from "react";
import { dbGet, dbSet, dbDelete } from "./db";

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

const STORE = "qa-runs" as const;
const EVENT = "uifa:qa-runs:changed";

const isBrowser = () => typeof window !== "undefined";
const newId = () => `qa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(EVENT));
}

export async function listRuns(targetKey: string): Promise<QARun[]> {
  return (await dbGet<QARun[]>(STORE, targetKey)) ?? [];
}

export async function getRun(targetKey: string, id: string): Promise<QARun | null> {
  const runs = await listRuns(targetKey);
  return runs.find((r) => r.id === id) ?? null;
}

export async function startRun(
  targetKey: string,
  results: Omit<QAResult, "evaluatedAt" | "notes" | "status">[]
): Promise<QARun> {
  const run: QARun = {
    id: newId(),
    targetKey,
    startedAt: Date.now(),
    completedAt: null,
    results: results.map((r) => ({ ...r, status: "pending", notes: "", evaluatedAt: null })),
  };
  const list = await listRuns(targetKey);
  await dbSet(STORE, targetKey, [run, ...list].slice(0, 20));
  emit();
  return run;
}

export async function patchRun(
  targetKey: string,
  runId: string,
  patch: Partial<QARun>
): Promise<QARun | null> {
  const list = await listRuns(targetKey);
  const idx = list.findIndex((r) => r.id === runId);
  if (idx === -1) return null;
  const next = { ...list[idx], ...patch };
  list[idx] = next;
  await dbSet(STORE, targetKey, list);
  emit();
  return next;
}

export async function setResult(
  targetKey: string,
  runId: string,
  testCaseId: string,
  status: QAStatus,
  notes?: string
): Promise<QARun | null> {
  const list = await listRuns(targetKey);
  const idx = list.findIndex((r) => r.id === runId);
  if (idx === -1) return null;
  const run = list[idx];
  list[idx] = {
    ...run,
    results: run.results.map((r) =>
      r.testCaseId === testCaseId
        ? { ...r, status, notes: notes ?? r.notes, evaluatedAt: Date.now() }
        : r
    ),
  };
  await dbSet(STORE, targetKey, list);
  emit();
  return list[idx];
}

export async function finishRun(targetKey: string, runId: string): Promise<QARun | null> {
  return patchRun(targetKey, runId, { completedAt: Date.now() });
}

export async function deleteRun(targetKey: string, runId: string): Promise<void> {
  const list = (await listRuns(targetKey)).filter((r) => r.id !== runId);
  if (list.length === 0) {
    await dbDelete(STORE, targetKey);
  } else {
    await dbSet(STORE, targetKey, list);
  }
  emit();
}

export function summarize(run: QARun) {
  const c = { pending: 0, pass: 0, fail: 0, blocked: 0, skipped: 0 };
  for (const r of run.results) c[r.status]++;
  const total = run.results.length;
  return { ...c, total, evaluated: total - c.pending };
}

export function useQAHistory(targetKey: string | null) {
  const [runs, setRuns] = useState<QARun[]>([]);

  const refresh = useCallback(() => {
    if (!targetKey) { setRuns([]); return; }
    void listRuns(targetKey).then(setRuns);
  }, [targetKey]);

  useEffect(() => {
    refresh();
    if (!isBrowser()) return;
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return runs;
}

export function useQARun(targetKey: string | null, runId: string | null) {
  const [run, setRun] = useState<QARun | null>(null);

  const refresh = useCallback(() => {
    if (!targetKey || !runId) { setRun(null); return; }
    void getRun(targetKey, runId).then(setRun);
  }, [targetKey, runId]);

  useEffect(() => {
    refresh();
    if (!isBrowser()) return;
    window.addEventListener(EVENT, refresh);
    return () => window.removeEventListener(EVENT, refresh);
  }, [refresh]);

  return run;
}
