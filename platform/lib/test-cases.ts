"use client";

import { useCallback, useEffect, useState } from "react";

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

const STORAGE_KEY = "uifa:test-cases:v1";

type Store = Record<string, TestCase[]>; // key = `${targetKey}::${nodeId}`

const isBrowser = () => typeof window !== "undefined";

function readStore(): Store {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota / serialization — swallow
  }
}

const compositeKey = (targetKey: string, nodeId: string) =>
  `${targetKey}::${nodeId}`;

const newId = () =>
  `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const EVENT = "uifa:test-cases:changed";

function emitChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getTestCases(
  targetKey: string,
  nodeId: string
): TestCase[] {
  const store = readStore();
  return store[compositeKey(targetKey, nodeId)] ?? [];
}

export function getTestCaseCounts(targetKey: string): Record<string, number> {
  const store = readStore();
  const prefix = `${targetKey}::`;
  const out: Record<string, number> = {};
  for (const k of Object.keys(store)) {
    if (!k.startsWith(prefix)) continue;
    const nodeId = k.slice(prefix.length);
    out[nodeId] = store[k]?.length ?? 0;
  }
  return out;
}

export function upsertTestCase(
  targetKey: string,
  nodeId: string,
  input: Omit<TestCase, "createdAt" | "updatedAt"> & {
    createdAt?: number;
  }
): TestCase {
  const store = readStore();
  const key = compositeKey(targetKey, nodeId);
  const list = store[key] ?? [];
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
  const nextList = existing
    ? list.map((t) => (t.id === tc.id ? tc : t))
    : [...list, tc];
  store[key] = nextList;
  writeStore(store);
  emitChange();
  return tc;
}

export function deleteTestCase(
  targetKey: string,
  nodeId: string,
  id: string
) {
  const store = readStore();
  const key = compositeKey(targetKey, nodeId);
  const list = store[key] ?? [];
  store[key] = list.filter((t) => t.id !== id);
  if (store[key].length === 0) delete store[key];
  writeStore(store);
  emitChange();
}

export function createDraft(): Omit<TestCase, "createdAt" | "updatedAt"> {
  return {
    id: newId(),
    title: "",
    body: "",
    priority: "P1",
    type: "functional",
  };
}

export function useTestCases(targetKey: string | null, nodeId: string | null) {
  const [cases, setCases] = useState<TestCase[]>([]);

  const refresh = useCallback(() => {
    if (!targetKey || !nodeId) {
      setCases([]);
      return;
    }
    setCases(getTestCases(targetKey, nodeId));
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

  return cases;
}

export function useTestCaseCounts(targetKey: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    if (!targetKey) {
      setCounts({});
      return;
    }
    setCounts(getTestCaseCounts(targetKey));
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

  return counts;
}
