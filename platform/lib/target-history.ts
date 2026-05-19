const STORAGE_KEY = "uifa:target-history:v1";
const MAX_ENTRIES = 5;

export type TargetHistoryEntry = {
  input: string;
  label: string;
  usedAt: number;
};

export function getHistory(): TargetHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as TargetHistoryEntry[];
  } catch {
    return [];
  }
}

export function addToHistory(input: string, label: string): void {
  if (typeof window === "undefined") return;
  const trimmed = input.trim();
  if (!trimmed) return;

  const existing = getHistory().filter((e) => e.input !== trimmed);
  const updated: TargetHistoryEntry[] = [
    { input: trimmed, label, usedAt: Date.now() },
    ...existing,
  ].slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // storage quota exceeded — ignore
  }
}
