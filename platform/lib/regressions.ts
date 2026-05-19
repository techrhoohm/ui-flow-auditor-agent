"use client";

import { useCallback, useEffect, useState } from "react";
import { dbGet, dbSet, dbGetAll, dbDeleteByPrefix } from "./db";

const STORE = "regressions" as const;
const EVENT = "uifa:regressions:changed";

export type RegressionResult = {
  percentChanged: number;
  changedPixels: number;
  totalPixels: number;
  diffDataUrl: string;
  baselineSavedAt: number;
  checkedAt: number;
};

const isBrowser = () => typeof window !== "undefined";
const compKey = (targetKey: string, nodeId: string) => `${targetKey}::${nodeId}`;

function emit() {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(EVENT));
}

export async function saveRegression(
  targetKey: string,
  nodeId: string,
  result: RegressionResult
): Promise<void> {
  await dbSet(STORE, compKey(targetKey, nodeId), result);
  emit();
}

export async function getRegression(
  targetKey: string,
  nodeId: string
): Promise<RegressionResult | null> {
  return (await dbGet<RegressionResult>(STORE, compKey(targetKey, nodeId))) ?? null;
}

export async function clearRegressions(targetKey: string): Promise<void> {
  await dbDeleteByPrefix(STORE, `${targetKey}::`);
  emit();
}

export async function getAllRegressions(
  targetKey: string
): Promise<Record<string, RegressionResult>> {
  const prefix = `${targetKey}::`;
  const items = await dbGetAll<RegressionResult>(STORE, prefix);
  const out: Record<string, RegressionResult> = {};
  for (const { key, value } of items) {
    out[key.slice(prefix.length)] = value;
  }
  return out;
}

export function useRegressions(targetKey: string | null) {
  const [regressions, setRegressions] = useState<Record<string, RegressionResult>>({});

  const refresh = useCallback(() => {
    if (!targetKey) { setRegressions({}); return; }
    void getAllRegressions(targetKey).then(setRegressions);
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
