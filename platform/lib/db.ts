"use client";

const DB_NAME = "uifa";
const DB_VERSION = 1;

export type StoreName =
  | "baselines"
  | "regressions"
  | "test-cases"
  | "test-scripts"
  | "test-script-results"
  | "qa-runs";

const ALL_STORES: StoreName[] = [
  "baselines",
  "regressions",
  "test-cases",
  "test-scripts",
  "test-script-results",
  "qa-runs",
];

let _db: IDBDatabase | null = null;

function open(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of ALL_STORES) {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name);
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSet(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readwrite").objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readwrite").objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll<T>(
  store: StoreName,
  prefix?: string
): Promise<Array<{ key: string; value: T }>> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out: Array<{ key: string; value: T }> = [];
    const req = db.transaction(store, "readonly").objectStore(store).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(out); return; }
      const k = cursor.key as string;
      if (!prefix || k.startsWith(prefix)) out.push({ key: k, value: cursor.value as T });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function dbDeleteByPrefix(store: StoreName, prefix: string): Promise<void> {
  const items = await dbGetAll(store, prefix);
  if (items.length === 0) return;
  const db = await open();
  await Promise.all(
    items.map(
      ({ key }) =>
        new Promise<void>((resolve, reject) => {
          const req = db.transaction(store, "readwrite").objectStore(store).delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
}
