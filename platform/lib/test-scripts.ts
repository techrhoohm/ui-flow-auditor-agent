"use client";

import { useCallback, useEffect, useState } from "react";
import { dbGet, dbSet, dbDelete, dbGetAll } from "./db";

export type TestScript = {
  id: string;
  name: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type ScriptRunStatus = "pass" | "fail" | "error";

export type ScriptResult = {
  status: ScriptRunStatus;
  durationMs: number;
  logs: { level: "log" | "warn" | "error"; message: string; at: number }[];
  error?: string;
  ranAt: number;
};

const SCRIPTS_STORE = "test-scripts" as const;
const RESULTS_STORE = "test-script-results" as const;
const EVENT = "uifa:test-scripts:changed";

const isBrowser = () => typeof window !== "undefined";
const compKey = (targetKey: string, nodeId: string) => `${targetKey}::${nodeId}`;
const newId = () => `ts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(EVENT));
}

export async function getScripts(targetKey: string, nodeId: string): Promise<TestScript[]> {
  return (await dbGet<TestScript[]>(SCRIPTS_STORE, compKey(targetKey, nodeId))) ?? [];
}

export async function getScriptCounts(targetKey: string): Promise<Record<string, number>> {
  const prefix = `${targetKey}::`;
  const items = await dbGetAll<TestScript[]>(SCRIPTS_STORE, prefix);
  const out: Record<string, number> = {};
  for (const { key, value } of items) out[key.slice(prefix.length)] = value.length;
  return out;
}

export async function getResults(
  targetKey: string,
  nodeId: string
): Promise<Record<string, ScriptResult>> {
  return (await dbGet<Record<string, ScriptResult>>(RESULTS_STORE, compKey(targetKey, nodeId))) ?? {};
}

export async function getResultSummary(
  targetKey: string
): Promise<Record<string, { pass: number; fail: number; error: number; total: number }>> {
  const prefix = `${targetKey}::`;
  const [scriptItems, resultItems] = await Promise.all([
    dbGetAll<TestScript[]>(SCRIPTS_STORE, prefix),
    dbGetAll<Record<string, ScriptResult>>(RESULTS_STORE, prefix),
  ]);
  const resultMap = Object.fromEntries(resultItems.map(({ key, value }) => [key, value]));
  const out: Record<string, { pass: number; fail: number; error: number; total: number }> = {};
  for (const { key, value: scripts } of scriptItems) {
    const nodeId = key.slice(prefix.length);
    const results = resultMap[key] ?? {};
    const summary = { pass: 0, fail: 0, error: 0, total: scripts.length };
    for (const s of scripts) {
      const r = results[s.id];
      if (r) summary[r.status]++;
    }
    out[nodeId] = summary;
  }
  return out;
}

export async function upsertScript(
  targetKey: string,
  nodeId: string,
  input: Omit<TestScript, "createdAt" | "updatedAt"> & { createdAt?: number }
): Promise<TestScript> {
  const key = compKey(targetKey, nodeId);
  const list = (await dbGet<TestScript[]>(SCRIPTS_STORE, key)) ?? [];
  const now = Date.now();
  const existing = list.find((t) => t.id === input.id);
  const ts: TestScript = {
    id: input.id,
    name: input.name,
    body: input.body,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };
  const nextList = existing ? list.map((t) => (t.id === ts.id ? ts : t)) : [...list, ts];
  await dbSet(SCRIPTS_STORE, key, nextList);
  emit();
  return ts;
}

export async function deleteScript(targetKey: string, nodeId: string, id: string): Promise<void> {
  const key = compKey(targetKey, nodeId);
  const list = ((await dbGet<TestScript[]>(SCRIPTS_STORE, key)) ?? []).filter((t) => t.id !== id);
  if (list.length === 0) {
    await dbDelete(SCRIPTS_STORE, key);
  } else {
    await dbSet(SCRIPTS_STORE, key, list);
  }
  const results = (await dbGet<Record<string, ScriptResult>>(RESULTS_STORE, key)) ?? {};
  delete results[id];
  if (Object.keys(results).length === 0) {
    await dbDelete(RESULTS_STORE, key);
  } else {
    await dbSet(RESULTS_STORE, key, results);
  }
  emit();
}

export async function saveResult(
  targetKey: string,
  nodeId: string,
  scriptId: string,
  result: ScriptResult
): Promise<void> {
  const key = compKey(targetKey, nodeId);
  const results = (await dbGet<Record<string, ScriptResult>>(RESULTS_STORE, key)) ?? {};
  results[scriptId] = result;
  await dbSet(RESULTS_STORE, key, results);
  emit();
}

export async function importScript(
  targetKey: string,
  nodeId: string,
  name: string,
  body: string
): Promise<TestScript> {
  return upsertScript(targetKey, nodeId, { id: newId(), name: name.trim() || "Imported script", body });
}

export function createDraftScript(): Omit<TestScript, "createdAt" | "updatedAt"> {
  return {
    id: newId(),
    name: "",
    body: `// 'page', 'url', 'expect', and 'console' are in scope.
// Throw to fail. Run completes => pass.
const title = await page.title();
console.log('title:', title);
expect(title).toBeTruthy();
`,
  };
}

export function useScripts(targetKey: string | null, nodeId: string | null) {
  const [scripts, setScripts] = useState<TestScript[]>([]);

  const refresh = useCallback(() => {
    if (!targetKey || !nodeId) { setScripts([]); return; }
    void getScripts(targetKey, nodeId).then(setScripts);
  }, [targetKey, nodeId]);

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

  return scripts;
}

export function useResults(targetKey: string | null, nodeId: string | null) {
  const [results, setResults] = useState<Record<string, ScriptResult>>({});

  const refresh = useCallback(() => {
    if (!targetKey || !nodeId) { setResults({}); return; }
    void getResults(targetKey, nodeId).then(setResults);
  }, [targetKey, nodeId]);

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

  return results;
}

export function useScriptSummaries(targetKey: string | null) {
  const [summaries, setSummaries] = useState<
    Record<string, { pass: number; fail: number; error: number; total: number }>
  >({});

  const refresh = useCallback(() => {
    if (!targetKey) { setSummaries({}); return; }
    void getResultSummary(targetKey).then(setSummaries);
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

  return summaries;
}
