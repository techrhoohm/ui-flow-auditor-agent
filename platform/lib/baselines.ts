"use client";

const STORAGE_KEY = "uifa:baselines:v1";
const EVENT = "uifa:baselines:changed";

type BaselineEntry = { dataUrl: string; savedAt: number };
type Store = Record<string, BaselineEntry>; // `${targetKey}::${nodeId}`

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

const key = (targetKey: string, nodeId: string) => `${targetKey}::${nodeId}`;

export function saveBaseline(targetKey: string, nodeId: string, dataUrl: string) {
  const store = read();
  store[key(targetKey, nodeId)] = { dataUrl, savedAt: Date.now() };
  write(store);
  emit();
}

export function getBaseline(
  targetKey: string,
  nodeId: string
): BaselineEntry | null {
  return read()[key(targetKey, nodeId)] ?? null;
}

export function clearBaselines(targetKey: string) {
  const store = read();
  const prefix = `${targetKey}::`;
  for (const k of Object.keys(store)) {
    if (k.startsWith(prefix)) delete store[k];
  }
  write(store);
  emit();
}

export type BaselineMeta = { count: number; savedAt: number | null };

export function getBaselineMeta(targetKey: string): BaselineMeta {
  const store = read();
  const prefix = `${targetKey}::`;
  let count = 0;
  let savedAt: number | null = null;
  for (const [k, v] of Object.entries(store)) {
    if (!k.startsWith(prefix)) continue;
    count++;
    if (!savedAt || v.savedAt > savedAt) savedAt = v.savedAt;
  }
  return { count, savedAt };
}

export const BASELINES_EVENT = EVENT;
