"use client";

import type { AuditRunResult } from "./audit-runner";
import { dbGet, dbSet } from "./db";

const HISTORY_KEY = "list";
const MAX_RUNS = 20;

export async function saveAuditHistory(runs: AuditRunResult[]): Promise<void> {
  await dbSet("audit-history", HISTORY_KEY, runs.slice(0, MAX_RUNS));
}

export async function loadAuditHistory(): Promise<AuditRunResult[]> {
  const runs = await dbGet<AuditRunResult[]>("audit-history", HISTORY_KEY);
  return runs ?? [];
}
