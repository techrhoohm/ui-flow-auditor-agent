"use client";

import { dbGet, dbSet, dbGetAll, dbDeleteByPrefix } from "./db";

const STORE = "baselines" as const;
const EVENT = "uifa:baselines:changed";

export type BaselineMeta = { count: number; savedAt: number | null };
type BaselineEntry = { dataUrl: string; savedAt: number };

const isBrowser = () => typeof window !== "undefined";
const compKey = (targetKey: string, nodeId: string) => `${targetKey}::${nodeId}`;

function emit() {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(EVENT));
}

export async function saveBaseline(targetKey: string, nodeId: string, dataUrl: string): Promise<void> {
  await dbSet(STORE, compKey(targetKey, nodeId), { dataUrl, savedAt: Date.now() } satisfies BaselineEntry);
  emit();
}

export async function getBaseline(targetKey: string, nodeId: string): Promise<BaselineEntry | null> {
  return (await dbGet<BaselineEntry>(STORE, compKey(targetKey, nodeId))) ?? null;
}

export async function clearBaselines(targetKey: string): Promise<void> {
  await dbDeleteByPrefix(STORE, `${targetKey}::`);
  emit();
}

export async function getBaselineMeta(targetKey: string): Promise<BaselineMeta> {
  const prefix = `${targetKey}::`;
  const items = await dbGetAll<BaselineEntry>(STORE, prefix);
  let savedAt: number | null = null;
  for (const { value } of items) {
    if (!savedAt || value.savedAt > savedAt) savedAt = value.savedAt;
  }
  return { count: items.length, savedAt };
}

export const BASELINES_EVENT = EVENT;
