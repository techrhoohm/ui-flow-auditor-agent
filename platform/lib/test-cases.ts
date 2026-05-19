"use client";

import { useCallback, useEffect, useState } from "react";
import { dbGet, dbSet, dbDelete, dbGetAll } from "./db";

export type Priority = "P0" | "P1" | "P2";
export type TestType = "functional" | "visual" | "a11y" | "perf";

export type TestCase = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  type: TestType;
  createdAt: number;
  updatedAt: number;
};

const STORE = "test-cases" as const;
const EVENT = "uifa:test-cases:changed";

const isBrowser = () => typeof window !== "undefined";
const compKey = (targetKey: string, nodeId: string) => `${targetKey}::${nodeId}`;
const newId = () => `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(EVENT));
}

export async function getTestCases(targetKey: string, nodeId: string): Promise<TestCase[]> {
  return (await dbGet<TestCase[]>(STORE, compKey(targetKey, nodeId))) ?? [];
}

export async function getTestCaseCounts(targetKey: string): Promise<Record<string, number>> {
  const prefix = `${targetKey}::`;
  const items = await dbGetAll<TestCase[]>(STORE, prefix);
  const out: Record<string, number> = {};
  for (const { key, value } of items) {
    out[key.slice(prefix.length)] = value.length;
  }
  return out;
}

export async function upsertTestCase(
  targetKey: string,
  nodeId: string,
  input: Omit<TestCase, "createdAt" | "updatedAt"> & { createdAt?: number }
): Promise<TestCase> {
  const key = compKey(targetKey, nodeId);
  const list = (await dbGet<TestCase[]>(STORE, key)) ?? [];
  const now = Date.now();
  const existing = list.find((t) => t.id === input.id);
  const tc: TestCase = {
    id: input.id,
    title: input.title,
    body: input.body,
    priority: input.priority,
    type: input.type,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };
  const nextList = existing ? list.map((t) => (t.id === tc.id ? tc : t)) : [...list, tc];
  await dbSet(STORE, key, nextList);
  emit();
  return tc;
}

export async function deleteTestCase(targetKey: string, nodeId: string, id: string): Promise<void> {
  const key = compKey(targetKey, nodeId);
  const list = ((await dbGet<TestCase[]>(STORE, key)) ?? []).filter((t) => t.id !== id);
  if (list.length === 0) {
    await dbDelete(STORE, key);
  } else {
    await dbSet(STORE, key, list);
  }
  emit();
}

export async function importTestCases(
  targetKey: string,
  nodeId: string,
  items: Array<{ title: string; body?: string; priority?: Priority; type?: TestType }>
): Promise<number> {
  const VALID_P = new Set<Priority>(["P0", "P1", "P2"]);
  const VALID_T = new Set<TestType>(["functional", "visual", "a11y", "perf"]);
  const key = compKey(targetKey, nodeId);
  const list = (await dbGet<TestCase[]>(STORE, key)) ?? [];
  const now = Date.now();
  let added = 0;
  for (const item of items) {
    const title = item.title?.trim();
    if (!title) continue;
    list.push({
      id: newId(),
      title,
      body: item.body?.trim() ?? "",
      priority: VALID_P.has(item.priority as Priority) ? (item.priority as Priority) : "P1",
      type: VALID_T.has(item.type as TestType) ? (item.type as TestType) : "functional",
      createdAt: now,
      updatedAt: now,
    });
    added++;
  }
  if (added > 0) {
    await dbSet(STORE, key, list);
    emit();
  }
  return added;
}

export function createDraft(): Omit<TestCase, "createdAt" | "updatedAt"> {
  return { id: newId(), title: "", body: "", priority: "P1", type: "functional" };
}

export function useTestCases(targetKey: string | null, nodeId: string | null) {
  const [cases, setCases] = useState<TestCase[]>([]);

  const refresh = useCallback(() => {
    if (!targetKey || !nodeId) { setCases([]); return; }
    void getTestCases(targetKey, nodeId).then(setCases);
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

  return cases;
}

export function useTestCaseCounts(targetKey: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    if (!targetKey) { setCounts({}); return; }
    void getTestCaseCounts(targetKey).then(setCounts);
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

  return counts;
}
