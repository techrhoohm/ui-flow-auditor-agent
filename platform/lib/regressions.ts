"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "uifa:regressions:v1";
const EVENT = "uifa:regressions:changed";

export type RegressionResult = {
  percentChanged: number;
  changedPixels: number;
  totalPixels: number;
  diffDataUrl: string;
  baselineSavedAt: number;
  checkedAt: number;
};

type Store = Record<string, RegressionResult>; // `${targetKey}::${nodeId}`

const isBrowser = () => typeof window !== "undefined";

function read(): Store {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function emit() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

const compositeKey = (targetKey: string, nodeId: string) =>
  `${targetKey}::${nodeId}`;

export function saveRegression(
  targetKey: string,
  nodeId: string,
  result: RegressionResult
) {
  const store = read();
  store[compositeKey(targetKey, nodeId)] = result;
  write(store);
  emit();
}

export function getRegression(
  targetKey: string,
  nodeId: string
): RegressionResult | null {
  return read()[compositeKey(targetKey, nodeId)] ?? null;
}

export function clearRegressions(targetKey: string) {
  const store = read();
  const prefix = `${targetKey}::`;
  for (const k of Object.keys(store)) {
    if (k.startsWith(prefix)) delete store[k];
  }
  write(store);
  emit();
}

export function getAllRegressions(
  targetKey: string
): Record<string, RegressionResult> {
  const store = read();
  const prefix = `${targetKey}::`;
  const out: Record<string, RegressionResult> = {};
  for (const [k, v] of Object.entries(store)) {
    if (!k.startsWith(prefix)) continue;
    const nodeId = k.slice(prefix.length);
    out[nodeId] = v;
  }
  return out;
}

export function useRegressions(targetKey: string | null) {
  const [regressions, setRegressions] = useState<
    Record<string, RegressionResult>
  >({});

  const refresh = useCallback(() => {
    if (!targetKey) { setRegressions({}); return; }
    setRegressions(getAllRegressions(targetKey));
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

  return regressions;
}
