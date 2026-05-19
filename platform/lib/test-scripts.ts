"use client";

import { useCallback, useEffect, useState } from "react";

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

const SCRIPTS_KEY = "uifa:test-scripts:v1";
const RESULTS_KEY = "uifa:test-scripts:results:v1";

type ScriptStore = Record<string, TestScript[]>;
type ResultStore = Record<string, Record<string, ScriptResult>>; // composite -> scriptId -> result

const isBrowser = () => typeof window !== "undefined";

function readStore<T>(key: string): T {
  if (!isBrowser()) return {} as T;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {} as T;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : ({} as T);
  } catch {
    return {} as T;
  }
}

function writeStore<T>(key: string, store: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // ignore
  }
}

const compositeKey = (targetKey: string, nodeId: string) =>
  `${targetKey}::${nodeId}`;

const newId = () =>
  `ts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const EVENT = "uifa:test-scripts:changed";

function emit() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getScripts(targetKey: string, nodeId: string): TestScript[] {
  const store = readStore<ScriptStore>(SCRIPTS_KEY);
  return store[compositeKey(targetKey, nodeId)] ?? [];
}

export function getScriptCounts(
  targetKey: string
): Record<string, number> {
  const store = readStore<ScriptStore>(SCRIPTS_KEY);
  const prefix = `${targetKey}::`;
  const out: Record<string, number> = {};
  for (const k of Object.keys(store)) {
    if (!k.startsWith(prefix)) continue;
    const nodeId = k.slice(prefix.length);
    out[nodeId] = store[k]?.length ?? 0;
  }
  return out;
}

export function getResults(
  targetKey: string,
  nodeId: string
): Record<string, ScriptResult> {
  const store = readStore<ResultStore>(RESULTS_KEY);
  return store[compositeKey(targetKey, nodeId)] ?? {};
}

export function getResultSummary(
  targetKey: string
): Record<string, { pass: number; fail: number; error: number; total: number }> {
  const scriptsStore = readStore<ScriptStore>(SCRIPTS_KEY);
  const resultsStore = readStore<ResultStore>(RESULTS_KEY);
  const out: Record<
    string,
    { pass: number; fail: number; error: number; total: number }
  > = {};
  const prefix = `${targetKey}::`;
  for (const k of Object.keys(scriptsStore)) {
    if (!k.startsWith(prefix)) continue;
    const nodeId = k.slice(prefix.length);
    const scripts = scriptsStore[k] ?? [];
    const results = resultsStore[k] ?? {};
    const summary = { pass: 0, fail: 0, error: 0, total: scripts.length };
    for (const s of scripts) {
      const r = results[s.id];
      if (!r) continue;
      summary[r.status]++;
    }
    out[nodeId] = summary;
  }
  return out;
}

export function upsertScript(
  targetKey: string,
  nodeId: string,
  input: Omit<TestScript, "createdAt" | "updatedAt"> & { createdAt?: number }
): TestScript {
  const store = readStore<ScriptStore>(SCRIPTS_KEY);
  const key = compositeKey(targetKey, nodeId);
  const list = store[key] ?? [];
  const now = Date.now();
  const existing = list.find((t) => t.id === input.id);
  const ts: TestScript = {
    id: input.id,
    name: input.name,
    body: input.body,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };
  const nextList = existing
    ? list.map((t) => (t.id === ts.id ? ts : t))
    : [...list, ts];
  store[key] = nextList;
  writeStore(SCRIPTS_KEY, store);
  emit();
  return ts;
}

export function deleteScript(targetKey: string, nodeId: string, id: string) {
  const store = readStore<ScriptStore>(SCRIPTS_KEY);
  const key = compositeKey(targetKey, nodeId);
  store[key] = (store[key] ?? []).filter((t) => t.id !== id);
  if (store[key].length === 0) delete store[key];
  writeStore(SCRIPTS_KEY, store);

  const results = readStore<ResultStore>(RESULTS_KEY);
  if (results[key]) {
    delete results[key][id];
    if (Object.keys(results[key]).length === 0) delete results[key];
    writeStore(RESULTS_KEY, results);
  }

  emit();
}

export function saveResult(
  targetKey: string,
  nodeId: string,
  scriptId: string,
  result: ScriptResult
) {
  const store = readStore<ResultStore>(RESULTS_KEY);
  const key = compositeKey(targetKey, nodeId);
  if (!store[key]) store[key] = {};
  store[key][scriptId] = result;
  writeStore(RESULTS_KEY, store);
  emit();
}

export function importScript(
  targetKey: string,
  nodeId: string,
  name: string,
  body: string
): TestScript {
  return upsertScript(targetKey, nodeId, {
    id: newId(),
    name: name.trim() || "Imported script",
    body,
  });
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
    if (!targetKey || !nodeId) {
      setScripts([]);
      return;
    }
    setScripts(getScripts(targetKey, nodeId));
  }, [targetKey, nodeId]);

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

  return scripts;
}

export function useResults(targetKey: string | null, nodeId: string | null) {
  const [results, setResults] = useState<Record<string, ScriptResult>>({});

  const refresh = useCallback(() => {
    if (!targetKey || !nodeId) {
      setResults({});
      return;
    }
    setResults(getResults(targetKey, nodeId));
  }, [targetKey, nodeId]);

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

  return results;
}

export function useScriptSummaries(targetKey: string | null) {
  const [summaries, setSummaries] = useState<
    Record<string, { pass: number; fail: number; error: number; total: number }>
  >({});

  const refresh = useCallback(() => {
    if (!targetKey) {
      setSummaries({});
      return;
    }
    setSummaries(getResultSummary(targetKey));
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

  return summaries;
}
